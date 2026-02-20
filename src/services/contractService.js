import { ethers } from "ethers";
import VaultAbi from "../abi/GroceryVault.abi.json";
import UsdcAbi from "../abi/USDC.abi.json";

const RPC_URL = process.env.REACT_APP_RPC_URL;
const VAULT_ADDRESS = process.env.REACT_APP_VAULT_ADDRESS;
const USDC_ADDRESS = process.env.REACT_APP_USDC_ADDRESS;

// Initialize provider (read-only)
export const provider = new ethers.JsonRpcProvider(RPC_URL);

// Get vault contract instance (read-only)
export const getVaultContract = () => {
  return new ethers.Contract(VAULT_ADDRESS, VaultAbi, provider);
};

// Get USDC contract instance (read-only)
export const getUsdcContract = () => {
  return new ethers.Contract(USDC_ADDRESS, UsdcAbi, provider);
};

// Get signer (write operations) - requires user to connect wallet
export const getVaultContractWithSigner = (signer) => {
  return new ethers.Contract(VAULT_ADDRESS, VaultAbi, signer);
};

export const getUsdcContractWithSigner = (signer) => {
  return new ethers.Contract(USDC_ADDRESS, UsdcAbi, signer);
};

// Helper: Get user's policy
export const getUserPolicy = async (userAddress) => {
  const vault = getVaultContract();
  return await vault.policyOf(userAddress);
};

// Helper: Get user's nonce
export const getUserNonce = async (userAddress) => {
  const vault = getVaultContract();
  return await vault.nonces(userAddress);
};

// Helper: Get USDC balance
export const getUsdcBalance = async (userAddress) => {
  const usdc = getUsdcContract();
  return await usdc.balanceOf(userAddress);
};

// Helper: Check if merchant is allowed
export const isMerchantAllowed = async (userAddress, merchantAddress) => {
  const vault = getVaultContract();
  return await vault.merchantAllowed(userAddress, merchantAddress);
};

// Helper: Check if agent is allowed
export const isAgentAllowed = async (userAddress, agentAddress) => {
  const vault = getVaultContract();
  return await vault.agentAllowed(userAddress, agentAddress);
};

// Helper: Execute intent (requires signer)
export const executeIntent = async (signer, intent, userSig = "0x") => {
  const vault = getVaultContractWithSigner(signer);
  return await vault.executeIntent(intent, userSig);
};

// Helper: Set policy (requires signer)
export const setPolicy = async (signer, policy) => {
  const vault = getVaultContractWithSigner(signer);
  return await vault.setPolicy(policy);
};

// Helper: Approve merchant (requires signer)
export const approveMerchant = async (signer, merchantAddress, allowed = true) => {
  const vault = getVaultContractWithSigner(signer);
  return await vault.setMerchantAllowed(merchantAddress, allowed);
};

// Helper: Approve agent (requires signer)
export const approveAgent = async (signer, agentAddress, allowed = true) => {
  const vault = getVaultContractWithSigner(signer);
  return await vault.setAgentAllowed(agentAddress, allowed);
};

// Helper: Approve USDC spending
export const approveUsdcSpending = async (signer, amount) => {
  const usdc = getUsdcContractWithSigner(signer);
  return await usdc.approve(VAULT_ADDRESS, amount);
};
