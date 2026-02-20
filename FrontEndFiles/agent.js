import "dotenv/config";
import { ethers } from "ethers";
import VaultAbi from "./GroceryVault.abi.json" assert { type: "json" };

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
const vault = new ethers.Contract(process.env.VAULT_ADDRESS, VaultAbi, signer);

async function run() {
  const user = "0xUSER...";
  const merchant = "0xMERCHANT...";
  const token = process.env.USDC_ADDRESS;

  // 1) Read current nonce from contract (must match intent.nonce)
  const nonce = await vault.nonces(user);

  // 2) Construct an intent (your AI agent decides amount/cartHash/deadline)
  const intent = {
    user,
    merchant,
    token,
    amount: ethers.parseUnits("85.00", 6),              // USDC 6 decimals
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
    cartHash: ethers.keccak256(ethers.toUtf8Bytes("cart-json-or-id")),
    nonce: nonce
  };

  // 3) If approval-first, you must collect user signature off-chain.
  // For autopay mode with allowlisted agent, pass empty sig:
  const userSig = "0x"; // or 65-byte signature

  // 4) Execute on-chain
  const tx = await vault.executeIntent(intent, userSig);
  console.log("sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("confirmed in block:", receipt.blockNumber);
}

run().catch(console.error);