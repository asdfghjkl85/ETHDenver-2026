# GroceryVault Backend Setup

## Installation

1. **Install backend dependencies:**
   ```bash
   npm install -g concurrently
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.server .env
   # Edit .env with your actual values:
   # - RPC_URL: Your Ethereum RPC endpoint (Infura, Alchemy, etc.)
   # - VAULT_ADDRESS: Your deployed GroceryVault contract address
   # - USDC_ADDRESS: USDC token address for your network
   # - AGENT_PRIVATE_KEY: Private key of your AI agent wallet
   # - PORT: Backend server port (default: 3001)
   nano .env
   ```

## Running the Application

### Option 1: Run everything together
```bash
npm run dev
```
This starts both the React frontend (port 3000) and Node.js backend (port 3001)

### Option 2: Run separately
```bash
# Terminal 1 - Backend Server
npm run server:dev

# Terminal 2 - React Frontend
npm start
```

### Option 3: Production mode
```bash
# Backend
npm run server

# Frontend (in another terminal)
npm start
```

## API Endpoints

### 1. Health Check
```bash
GET http://localhost:3001/api/health
```

### 2. Get AI Recommendations
```bash
GET http://localhost:3001/api/recommendations?userAddress=0x...&diet=balanced&householdSize=2&budget=100
```

**Query Parameters:**
- `userAddress` (required): User's wallet address
- `diet`: "balanced", "vegan", or "keto" (default: balanced)
- `householdSize`: Number of people (default: 1)
- `budget`: Weekly budget in USDC (default: policy.weeklyCap)

**Response:**
```json
{
  "success": true,
  "userAddress": "0x...",
  "policy": { ... },
  "balance": "1000000",
  "recommendations": [
    {
      "item": "Organic Lentils (1lb)",
      "price": 2.5,
      "nutrition": "20g protein, high fiber",
      "provider": "Whole Foods",
      "qty": 40,
      "totalPrice": 100,
      "reason": "High protein plant-based staple"
    }
  ],
  "summary": {
    "totalCost": 100,
    "withinBudget": true,
    "savingsFromBudget": 0,
    "estimatedMeals": 300
  }
}
```

### 3. Get User Policy
```bash
GET http://localhost:3001/api/user-policy/:userAddress
```

### 4. Get Food Providers
```bash
GET http://localhost:3001/api/food-providers
```

### 5. Execute Purchase
```bash
POST http://localhost:3001/api/execute-purchase
Content-Type: application/json

{
  "userAddress": "0xUSER_ADDRESS",
  "merchant": "0xMERCHANT_ADDRESS",
  "amount": 50
}
```

## Testing

Run the test suite:
```bash
node test.js
```

This will test all API endpoints with different diet preferences and parameters.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  React Frontend (3000)                   │
│  - User preferences, wallet connection, UI              │
│  - Calls AI Agent API for recommendations               │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST API
                       ▼
┌─────────────────────────────────────────────────────────┐
│           Express Backend / AI Agent (3001)              │
│  - AI recommendation engine                              │
│  - Blockchain contract interaction                      │
│  - Food provider database                               │
│  - Purchase execution                                   │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐   ┌──────────┐   ┌──────────┐
   │ Ethereum│   │ USDC     │   │ Food     │
   │ Network │   │ Contract │   │Providers │
   └─────────┘   └──────────┘   └──────────┘
```

## Environment Setup

The application uses two environment files:
- **Frontend**: `.env.local` - Set `REACT_APP_*` variables
- **Backend**: `.env` - Set backend variables (RPC_URL, VAULT_ADDRESS, etc.)

Both are git-ignored for security.

## Notes

- The AI recommendation engine provides suggestions based on diet type, household size, and budget
- All recommendations respect the user's spending policy from the GroceryVault contract
- The backend validates purchases against on-chain policies before execution
- Food providers are currently mocked but can be replaced with real APIs
