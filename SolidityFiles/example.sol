// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
 * GroceryVault (MVP Example)
 * - User deposits an ERC20 (e.g., USDC)
 * - User sets spending policy (monthly/weekly/per-tx caps, allowed merchants)
 * - Off-chain agent proposes intents; contract enforces policy
 * - Can execute via:
 *    (A) user EIP-712 signature approval, or
 *    (B) allowlisted "agent/session key" address (autonomous)
 *
 * NOTE: For production, add:
 * - upgradeability strategy (or not)
 * - stronger period accounting (calendar months vs rolling windows)
 * - pausing, reentrancy guards (here we keep it simple)
 * - careful handling of fee-on-transfer tokens (we assume normal ERC20)
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

contract GroceryVault {
    // ---------- Types ----------
    struct Policy {
        uint256 monthlyCap;     // max spend per rolling 30-day window
        uint256 weeklyCap;      // max spend per rolling 7-day window
        uint256 perTxCap;       // max spend per transaction
        bool    requireUserSig; // if true, every intent must be user-signed
    }

    struct Intent {
        address user;           // vault owner
        address merchant;       // payout address (or adapter)
        address token;          // ERC20 token address
        uint256 amount;         // token amount
        uint256 deadline;       // unix time by which intent must be executed
        bytes32 cartHash;       // optional: hash of cart payload stored off-chain (audit)
        uint256 nonce;          // user nonce (prevents replay)
    }

    // ---------- Storage ----------
    mapping(address => Policy) public policyOf;

    // merchants allowlist per user
    mapping(address => mapping(address => bool)) public merchantAllowed;

    // allowlisted agents/session keys per user
    mapping(address => mapping(address => bool)) public agentAllowed;

    // accounting (rolling windows)
    struct SpendWindow {
        uint256 weekStart;
        uint256 weekSpent;
        uint256 monthStart;
        uint256 monthSpent;
    }
    mapping(address => SpendWindow) private spend;

    // nonce per user for EIP-712 approvals / replay protection
    mapping(address => uint256) public nonces;

    // used intents to prevent replays even if nonce reused incorrectly
    mapping(bytes32 => bool) public intentUsed;

    // ---------- EIP-712 ----------
    bytes32 private immutable DOMAIN_SEPARATOR;
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant INTENT_TYPEHASH =
        keccak256("Intent(address user,address merchant,address token,uint256 amount,uint256 deadline,bytes32 cartHash,uint256 nonce)");

    // ---------- Events ----------
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount, address to);

    event PolicyUpdated(address indexed user, uint256 monthlyCap, uint256 weeklyCap, uint256 perTxCap, bool requireUserSig);
    event MerchantAllowed(address indexed user, address indexed merchant, bool allowed);
    event AgentAllowed(address indexed user, address indexed agent, bool allowed);

    event IntentExecuted(bytes32 indexed intentId, address indexed user, address indexed merchant, address token, uint256 amount);

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("GroceryVault")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // ---------- User configuration ----------
    function setPolicy(Policy calldata p) external {
        // basic sanity
        require(p.perTxCap <= p.weeklyCap && p.perTxCap <= p.monthlyCap, "caps: perTx too high");
        policyOf[msg.sender] = p;
        emit PolicyUpdated(msg.sender, p.monthlyCap, p.weeklyCap, p.perTxCap, p.requireUserSig);
    }

    function setMerchantAllowed(address merchant, bool allowed) external {
        merchantAllowed[msg.sender][merchant] = allowed;
        emit MerchantAllowed(msg.sender, merchant, allowed);
    }

    function setAgentAllowed(address agent, bool allowed) external {
        agentAllowed[msg.sender][agent] = allowed;
        emit AgentAllowed(msg.sender, agent, allowed);
    }

    // ---------- Funds management ----------
    function deposit(address token, uint256 amount) external {
        require(amount > 0, "amount=0");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        emit Deposited(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount, address to) external {
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        // OPTIONAL: enforce cannot withdraw below some reserved amount; MVP does not
        require(IERC20(token).transfer(to, amount), "transfer failed");
        emit Withdrawn(msg.sender, token, amount, to);
    }

    // ---------- Core execution ----------
    /**
     * Execute an intent. Caller can be:
     * - the user themselves
     * - an allowlisted agent for the user (session key)
     * - anyone, if a valid user signature is provided and policy allows it
     */
    function executeIntent(
        Intent calldata intent,
        bytes calldata userSig // pass empty if not required / if caller is allowlisted agent
    ) external {
        require(block.timestamp <= intent.deadline, "expired");
        require(intent.user != address(0), "user=0");
        require(intent.amount > 0, "amount=0");

        Policy memory p = policyOf[intent.user];
        require(intent.amount <= p.perTxCap, "perTx cap");

        require(merchantAllowed[intent.user][intent.merchant], "merchant not allowed");
        // token allowlist could be added similarly; for MVP you might hardcode USDC.

        // Replay protection
        require(intent.nonce == nonces[intent.user], "bad nonce");

        bytes32 intentId = _hashIntent(intent);
        require(!intentUsed[intentId], "intent used");
        intentUsed[intentId] = true;

        // Authorization:
        // If requireUserSig = true, must have user signature.
        // Otherwise, allow either allowlisted agent OR a valid signature OR user themselves.
        bool callerIsUser = (msg.sender == intent.user);
        bool callerIsAgent = agentAllowed[intent.user][msg.sender];

        if (p.requireUserSig) {
            require(_verifyUserSig(intent, userSig), "sig required/invalid");
        } else {
            if (!(callerIsUser || callerIsAgent)) {
                // if not user/agent, must have a valid user signature
                require(_verifyUserSig(intent, userSig), "not authorized");
            } else {
                // user/agent path: signature optional
                if (userSig.length > 0) {
                    require(_verifyUserSig(intent, userSig), "sig invalid");
                }
            }
        }

        // Spend window enforcement
        _rollWindowsIfNeeded(intent.user);
        SpendWindow storage w = spend[intent.user];

        require(w.weekSpent + intent.amount <= p.weeklyCap, "weekly cap");
        require(w.monthSpent + intent.amount <= p.monthlyCap, "monthly cap");

        // Effects
        w.weekSpent += intent.amount;
        w.monthSpent += intent.amount;
        nonces[intent.user] += 1;

        // Interaction
        require(IERC20(intent.token).transfer(intent.merchant, intent.amount), "transfer failed");

        emit IntentExecuted(intentId, intent.user, intent.merchant, intent.token, intent.amount);
    }

    // ---------- Views ----------
    function remainingWeekly(address user) external view returns (uint256) {
        Policy memory p = policyOf[user];
        SpendWindow memory w = spend[user];
        (uint256 ws, uint256 spent) = _viewRolledWeek(w.weekStart, w.weekSpent);
        // silence unused var warning for ws
        ws = ws;
        if (spent >= p.weeklyCap) return 0;
        return p.weeklyCap - spent;
    }

    function remainingMonthly(address user) external view returns (uint256) {
        Policy memory p = policyOf[user];
        SpendWindow memory w = spend[user];
        (uint256 ms, uint256 spent) = _viewRolledMonth(w.monthStart, w.monthSpent);
        ms = ms;
        if (spent >= p.monthlyCap) return 0;
        return p.monthlyCap - spent;
    }

    // ---------- Internal helpers ----------
    function _rollWindowsIfNeeded(address user) internal {
        SpendWindow storage w = spend[user];

        // Initialize if first time
        if (w.weekStart == 0) {
            w.weekStart = block.timestamp;
            w.monthStart = block.timestamp;
            return;
        }

        // Rolling week = 7 days
        if (block.timestamp >= w.weekStart + 7 days) {
            w.weekStart = block.timestamp;
            w.weekSpent = 0;
        }

        // Rolling month = 30 days (MVP)
        if (block.timestamp >= w.monthStart + 30 days) {
            w.monthStart = block.timestamp;
            w.monthSpent = 0;
        }
    }

    function _viewRolledWeek(uint256 weekStart, uint256 weekSpent) internal view returns (uint256, uint256) {
        if (weekStart == 0) return (0, 0);
        if (block.timestamp >= weekStart + 7 days) return (block.timestamp, 0);
        return (weekStart, weekSpent);
    }

    function _viewRolledMonth(uint256 monthStart, uint256 monthSpent) internal view returns (uint256, uint256) {
        if (monthStart == 0) return (0, 0);
        if (block.timestamp >= monthStart + 30 days) return (block.timestamp, 0);
        return (monthStart, monthSpent);
    }

    function _hashIntent(Intent calldata intent) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.user,
                intent.merchant,
                intent.token,
                intent.amount,
                intent.deadline,
                intent.cartHash,
                intent.nonce
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    function _verifyUserSig(Intent calldata intent, bytes calldata sig) internal view returns (bool) {
        if (sig.length != 65) return false;
        bytes32 digest = _hashIntent(intent);

        bytes32 r;
        bytes32 s;
        uint8 v;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }

        address recovered = ecrecover(digest, v, r, s);
        return recovered == intent.user;
    }
}