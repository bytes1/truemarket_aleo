// @/lib/abi/VaultABI.ts
export const vaultABI = [
  {
    "type": "function",
    "name": "provideLiquidity",
    "stateMutability": "nonpayable",
    "inputs": [{ "name": "amount", "type": "uint256" }],
    "outputs": []
  },
  {
    "type": "function",
    "name": "marketName",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "name": "", "type": "string" }]
  },
  {
    "type": "function",
    "name": "totalRaised",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }]
  },
  {
    "type": "function",
    "name": "targetLiquidity",
    "stateMutability": "view",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256" }]
  }
] as const; // <--- CRITICAL