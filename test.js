import axios from "axios";

const API_BASE = "http://localhost:3001/api";

// Test user address (replace with real address)
const testUser = "0x1234567890123456789012345678901234567890";

async function testAPI() {
  console.log("🧪 Testing GroceryVault AI Agent API...\n");

  try {
    // 1. Health check
    console.log("1️⃣  Health Check:");
    const health = await axios.get(`${API_BASE}/health`);
    console.log(health.data);
    console.log();

    // 2. Get food providers
    console.log("2️⃣  Available Food Providers:");
    const providers = await axios.get(`${API_BASE}/food-providers`);
    console.log(JSON.stringify(providers.data, null, 2));
    console.log();

    // 3. Get recommendations (balanced diet)
    console.log("3️⃣  AI Recommendations (Balanced Diet):");
    const recsBalanced = await axios.get(`${API_BASE}/recommendations`, {
      params: {
        userAddress: testUser,
        diet: "balanced",
        householdSize: 2
      }
    });
    console.log(JSON.stringify(recsBalanced.data, null, 2));
    console.log();

    // 4. Get recommendations (vegan diet)
    console.log("4️⃣  AI Recommendations (Vegan Diet):");
    const recsVegan = await axios.get(`${API_BASE}/recommendations`, {
      params: {
        userAddress: testUser,
        diet: "vegan",
        budget: 50
      }
    });
    console.log(JSON.stringify(recsVegan.data, null, 2));
    console.log();

    // 5. Get recommendations (keto diet)
    console.log("5️⃣  AI Recommendations (Keto Diet):");
    const recsKeto = await axios.get(`${API_BASE}/recommendations`, {
      params: {
        userAddress: testUser,
        diet: "keto",
        householdSize: 1
      }
    });
    console.log(JSON.stringify(recsKeto.data, null, 2));
    console.log();

    console.log("✅ All tests completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
  }
}

testAPI();
