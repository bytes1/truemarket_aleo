// frontendv2/lib/abi/PredictionMarketABI.ts
export const predictionMarketABI = [
  {
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "closesAt", "type": "uint256" },
      { "name": "outcomeCount", "type": "uint256" },
      { "name": "question", "type": "string" },
      { "name": "arbitrator", "type": "address" },
      { "name": "timeout", "type": "uint32" },
      { "name": "initialLiquidity", "type": "uint256" }
    ],
    "name": "createMarket",
    "outputs": [{ "name": "id", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "id", "type": "uint256" },
      { "name": "outcome", "type": "uint256" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "buy",
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "id", "type": "uint256" },
      { "name": "outcome", "type": "uint256" },
      { "name": "sharesAmount", "type": "uint256" }
    ],
    "name": "sell",
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "id", "type": "uint256" },
      { "name": "outcome", "type": "uint256" }
    ],
    "name": "getPrice",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "id", "type": "uint256" }],
    "name": "markets",
    "outputs": [
      { "name": "token", "type": "address" },
      { "name": "closesAt", "type": "uint256" },
      { "name": "outcomeCount", "type": "uint256" },
      { "name": "liquidity", "type": "uint256" },
      { "name": "balance", "type": "uint256" },
      { "name": "state", "type": "uint8" },
      { "name": "questionId", "type": "bytes32" },
      { "name": "reality", "type": "address" },
      { "name": "resolvedOutcome", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;