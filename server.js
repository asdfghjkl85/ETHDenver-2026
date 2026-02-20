import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";
import axios from "axios";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Load ABI
const vaultAbi = JSON.parse(fs.readFileSync("./src/abi/GroceryVault.abi.json", "utf8"));
const usdcAbi = JSON.parse(fs.readFileSync("./src/abi/USDC.abi.json", "utf8"));

// Initialize provider
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Initialize signer (skip if private key is placeholder)
let signer;
if (process.env.AGENT_PRIVATE_KEY && process.env.AGENT_PRIVATE_KEY !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
  try {
    signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
    console.log('✅ Signer initialized from AGENT_PRIVATE_KEY');
  } catch (error) {
    console.warn('⚠️  Invalid AGENT_PRIVATE_KEY in .env - read-only mode enabled');
    signer = null;
  }
} else {
  console.warn('⚠️  AGENT_PRIVATE_KEY not set - read-only mode enabled');
  signer = null;
}

const vault = signer ? new ethers.Contract(process.env.VAULT_ADDRESS, vaultAbi, signer) : new ethers.Contract(process.env.VAULT_ADDRESS, vaultAbi, provider);
const usdc = signer ? new ethers.Contract(process.env.USDC_ADDRESS, usdcAbi, signer) : new ethers.Contract(process.env.USDC_ADDRESS, usdcAbi, provider);

// Mock food providers database (in production, use real API)
const foodProviders = {
  "0xwholefoods": {
    name: "Whole Foods",
    categories: ["produce", "dairy", "meat", "bakery"],
    avgPrice: 1.5
  },
  "0xtradedjoes": {
    name: "Trader Joe's",
    categories: ["frozen", "organic", "snacks"],
    avgPrice: 1.2
  },
  "0xcostco": {
    name: "Costco",
    categories: ["bulk", "meat", "produce"],
    avgPrice: 0.9
  }
};

// ============ AI RECOMMENDATION ENGINE ============

/**
 * Generate AI-based grocery recommendations
 * Based on user budget, dietary preferences, and available balance
 */
async function generateGroceryRecommendations(userAddress, preferences = {}) {
  try {
    // Default preferences (use provided budget or fallback)
    const diet = preferences.diet || "balanced"; // balanced, vegan, keto, etc.
    const budget = preferences.budget || 100; // Default budget
    const household = preferences.householdSize || 1;

    // Skip contract calls if vault address is placeholder (0x0000...)
    let policy = null;
    let balance = null;
    
    if (process.env.VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      try {
        policy = await vault.policyOf(userAddress);
        balance = await usdc.balanceOf(userAddress);
      } catch (contractError) {
        console.warn('⚠️  Could not fetch contract data:', contractError.message);
        policy = null;
        balance = null;
      }
    }

    // Generate recommendations based on AI logic
    const recommendations = [];

    // Vegan recommendations
    if (diet === "vegan") {
      recommendations.push({
        item: "Organic Lentils (1lb)",
        price: 2.5,
        nutrition: "20g protein, high fiber",
        provider: "Whole Foods",
        qty: Math.floor(budget / 2.5),
        reason: "High protein plant-based staple"
      });
      recommendations.push({
        item: "Tofu Block",
        price: 3.99,
        nutrition: "15g protein per serving",
        provider: "Trader Joe's",
        qty: 2,
        reason: "Versatile protein source"
      });
    }

    // Keto recommendations
    if (diet === "keto") {
      recommendations.push({
        item: "Grass-fed Beef (2lb)",
        price: 12.99,
        nutrition: "26g protein per serving",
        provider: "Whole Foods",
        qty: 1,
        reason: "High quality protein"
      });
      recommendations.push({
        item: "Organic Eggs (dozen)",
        price: 5.99,
        nutrition: "6g protein per egg",
        provider: "Costco",
        qty: 2,
        reason: "Keto-friendly staple"
      });
    }

    // Balanced diet (default)
    if (diet === "balanced" || recommendations.length === 0) {
      recommendations.push({
        item: "Chicken Breast (2lb)",
        price: 7.99,
        nutrition: "35g protein",
        provider: "Costco",
        qty: 1,
        reason: "Lean protein source"
      });
      recommendations.push({
        item: "Mixed Vegetables Bag",
        price: 4.5,
        nutrition: "Rich in vitamins",
        provider: "Trader Joe's",
        qty: 2,
        reason: "Daily vegetable intake"
      });
      recommendations.push({
        item: "Brown Rice (2lb)",
        price: 3.0,
        nutrition: "Whole grain carbs",
        provider: "Trader Joe's",
        qty: 1,
        reason: "Healthy carbs"
      });
    }

    // Add household size multiplier
    recommendations.forEach(rec => {
      rec.adjustedQty = rec.qty * household;
      rec.totalPrice = rec.price * rec.adjustedQty;
    });

    // Calculate totals
    const totalCost = recommendations.reduce((sum, rec) => sum + rec.totalPrice, 0);
    const withinBudget = totalCost <= budget;

    return {
      success: true,
      userAddress,
      diet,
      policy: policy ? {
        monthlyCap: policy.monthlyCap.toString(),
        weeklyCap: policy.weeklyCap.toString(),
        perTxCap: policy.perTxCap.toString()
      } : null,
      balance: balance ? balance.toString() : null,
      recommendations,
      summary: {
        totalCost,
        withinBudget,
        savingsFromBudget: budget - totalCost,
        estimatedMeals: Math.ceil(totalCost * 3) // rough estimate
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============ INTENT EXECUTION ============

/**
 * Execute a grocery purchase intent
 */
async function executePurchaseIntent(userAddress, merchant, amount) {
  try {
    const nonce = await vault.nonces(userAddress);

    const intent = {
      user: userAddress,
      merchant: merchant,
      token: process.env.USDC_ADDRESS,
      amount: ethers.parseUnits(amount.toString(), 6),
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      cartHash: ethers.keccak256(ethers.toUtf8Bytes("cart-" + Date.now())),
      nonce: nonce
    };

    const tx = await vault.executeIntent(intent, "0x");
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============ API ROUTES ============

/**
 * GET /api/recommendations
 * Get AI recommendations for user
 */
app.get("/api/recommendations", async (req, res) => {
  const { userAddress, diet, budget, householdSize } = req.query;

  if (!userAddress) {
    return res.status(400).json({ error: "userAddress required" });
  }

  const preferences = {
    diet: diet || "balanced",
    budget: budget ? parseFloat(budget) : undefined,
    householdSize: householdSize ? parseInt(householdSize) : 1
  };

  const result = await generateGroceryRecommendations(userAddress, preferences);
  res.json(result);
});

/**
 * GET /api/user-policy/:userAddress
 * Get user's spending policy from contract
 */
app.get("/api/user-policy/:userAddress", async (req, res) => {
  try {
    const { userAddress } = req.params;
    const policy = await vault.policyOf(userAddress);
    const nonce = await vault.nonces(userAddress);
    const balance = await usdc.balanceOf(userAddress);

    res.json({
      success: true,
      userAddress,
      policy: {
        monthlyCap: policy.monthlyCap.toString(),
        weeklyCap: policy.weeklyCap.toString(),
        perTxCap: policy.perTxCap.toString(),
        requireUserSig: policy.requireUserSig
      },
      nonce: nonce.toString(),
      balance: balance.toString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/food-providers
 * Get list of available food providers
 */
app.get("/api/food-providers", (req, res) => {
  res.json({
    success: true,
    providers: foodProviders
  });
});

/**
 * POST /api/execute-purchase
 * Execute a grocery purchase
 */
app.post("/api/execute-purchase", async (req, res) => {
  try {
    const { userAddress, merchant, amount } = req.body;

    if (!userAddress || !merchant || !amount) {
      return res.status(400).json({
        error: "userAddress, merchant, and amount required"
      });
    }

    const result = await executePurchaseIntent(userAddress, merchant, amount);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    vaultAddress: process.env.VAULT_ADDRESS,
    usdcAddress: process.env.USDC_ADDRESS
  });
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 GroceryVault AI Agent running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎯 Recommendations: http://localhost:${PORT}/api/recommendations?userAddress=0x...&diet=balanced`);
});
