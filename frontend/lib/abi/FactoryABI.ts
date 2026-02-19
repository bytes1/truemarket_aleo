// @/lib/abi/FactoryABI.ts

export const factoryABI = [
  {
    "inputs": [
      { "name": "_token", "type": "address" },
      { "name": "_target", "type": "uint256" },
      { "name": "_name", "type": "string" }
    ],
    "name": "createVault",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getVaults",
    "outputs": [
      { "name": "", "type": "address[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "", "type": "uint256" }
    ],
    "name": "allVaults",
    "outputs": [
      { "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;