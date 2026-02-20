import React, { useState, useEffect } from "react";
import './App.css';
import { useWeb3 } from "./hooks/useWeb3";
import { useAIRecommendations, useFoodProviders } from "./hooks/useAIAgent";

function App() {
  const { account, signer, isConnected, connectWallet, error: walletError } = useWeb3();
  const [diet, setDiet] = useState("balanced");
  const [householdSize, setHouseholdSize] = useState(1);
  const [budget, setBudget] = useState(100);
  
  const { recommendations, loading: recsLoading, error: recsError } = useAIRecommendations(
    account,
    { diet, householdSize, budget }
  );
  const { providers } = useFoodProviders();

  const handleDietChange = (e) => setDiet(e.target.value);
  const handleHouseholdChange = (e) => setHouseholdSize(parseInt(e.target.value));
  const handleBudgetChange = (e) => setBudget(parseFloat(e.target.value));

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>🛒 GroceryVault AI Agent</h1>
      <p>Smart grocery shopping powered by blockchain and AI</p>

      {/* Wallet Connection */}
      <div style={{ marginBottom: "30px", padding: "15px", backgroundColor: "#f0f0f0", borderRadius: "8px" }}>
        <button onClick={connectWallet} style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}>
          {isConnected && account ? `✓ Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
        </button>
        {walletError && <p style={{ color: "red" }}>Error: {walletError}</p>}
      </div>

      {account && (
        <>
          {/* Preferences Section */}
          <div style={{ marginBottom: "30px", padding: "15px", backgroundColor: "#f9f9f9", borderRadius: "8px", border: "1px solid #ddd" }}>
            <h2>🎯 Your Preferences</h2>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "15px" }}>
              <div>
                <label>Diet Type:</label>
                <select value={diet} onChange={handleDietChange} style={{ width: "100%", padding: "8px" }}>
                  <option value="balanced">Balanced</option>
                  <option value="vegan">Vegan</option>
                  <option value="keto">Keto</option>
                </select>
              </div>

              <div>
                <label>Household Size:</label>
                <input 
                  type="number" 
                  min="1" 
                  max="10" 
                  value={householdSize} 
                  onChange={handleHouseholdChange}
                  style={{ width: "100%", padding: "8px" }}
                />
              </div>

              <div>
                <label>Weekly Budget: ${budget}</label>
                <input 
                  type="range" 
                  min="10" 
                  max="500" 
                  value={budget} 
                  onChange={handleBudgetChange}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          </div>

          {/* Recommendations Section */}
          {recsLoading && <p>Loading recommendations...</p>}
          {recsError && <p style={{ color: "red" }}>Error: {recsError}</p>}

          {recommendations && recommendations.success && (
            <>
              <div style={{ marginBottom: "30px", padding: "15px", backgroundColor: "#e8f4f8", borderRadius: "8px" }}>
                <h2>💡 AI Recommendations</h2>
                <p>Based on your {diet} diet preferences and household size of {householdSize}</p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px", marginTop: "15px" }}>
                  {recommendations.recommendations.map((item, idx) => (
                    <div key={idx} style={{ padding: "15px", backgroundColor: "white", borderRadius: "8px", border: "1px solid #ddd", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                      <h3>{item.item}</h3>
                      <p><strong>Price:</strong> ${item.price}</p>
                      <p><strong>Total for {item.adjustedQty}x:</strong> ${item.totalPrice.toFixed(2)}</p>
                      <p><strong>Nutrition:</strong> {item.nutrition}</p>
                      <p><strong>Provider:</strong> {item.provider}</p>
                      <p><em>{item.reason}</em></p>
                      <button style={{ width: "100%", padding: "8px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                        Add to Cart
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#ffffff", borderRadius: "8px", border: "2px solid #4CAF50" }}>
                  <h3>📊 Summary</h3>
                  <p><strong>Total Cost:</strong> ${recommendations.summary.totalCost.toFixed(2)}</p>
                  <p><strong>Your Budget:</strong> ${budget}</p>
                  <p style={{ color: recommendations.summary.withinBudget ? "green" : "red" }}>
                    <strong>{recommendations.summary.withinBudget ? "✓ Within Budget" : "✗ Over Budget"}</strong>
                  </p>
                  <p><strong>Estimated Meals:</strong> {recommendations.summary.estimatedMeals}</p>
                  {recommendations.summary.savingsFromBudget > 0 && (
                    <p style={{ color: "green" }}><strong>$ Savings: ${recommendations.summary.savingsFromBudget.toFixed(2)}</strong></p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Food Providers */}
          {providers && (
            <div style={{ marginTop: "30px", padding: "15px", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
              <h2>🏪 Available Providers</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "15px" }}>
                {Object.entries(providers).map(([key, provider]) => (
                  <div key={key} style={{ padding: "15px", backgroundColor: "white", borderRadius: "8px", border: "1px solid #ddd" }}>
                    <h3>{provider.name}</h3>
                    <p><strong>Categories:</strong> {provider.categories.join(", ")}</p>
                    <p><strong>Avg Price:</strong> ${provider.avgPrice}/lb</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!account && <p style={{ textAlign: "center", marginTop: "50px", color: "#666" }}>Connect your wallet to get started</p>}
    </div>
  );
}

export default App;
