# True Markets 🔮

True Markets is a fully decentralized, zero-knowledge prediction market built on the Aleo blockchain. It allows users to trade shares on the outcomes of future events using an Automated Market Maker (AMM) model, ensuring continuous liquidity and fair, mathematically driven pricing.

## ✨ Features

* **Zero-Knowledge Trading:** Built on Aleo to leverage private, cryptographic executions.
* **Automated Market Maker (AMM):** Uses a constant-product formula (`x * y = k`) to dynamically price "Yes" and "No" shares based on market demand.
* **True Market Token (TMT):** Integrated custom SPL-style token natively used for all platform trades.
* **Built-In Faucet:** Seamless frontend faucet allowing users to instantly mint test TMT to start trading.
* **Provable Network Integration:** Fetches on-chain mapping data natively via the Provable REST API using URL-encoded struct keys—eliminating heavy WASM dependencies on the client.

## 🏗️ Architecture

The repository is divided into two main environments: the Leo smart contracts and the Next.js frontend.

### Smart Contracts (`/contracts`)
* **`true_market_token`**: The core SPL-like token contract (`true_market_token.aleo`) that handles minting, approvals, and transfers.
* **`ture_prediction_market1`**: The main AMM logic (`ture_prediction_market.aleo`). It handles market creation, share purchasing, outcome resolution, and winner payouts.

### Frontend (`/frontend`)
* A React/Next.js application utilizing Tailwind CSS and `shadcn/ui` components.
* Integrates `@provablehq/aleo-wallet-adaptor-react` for seamless wallet connectivity and transaction signing.

## 🚀 Getting Started



### 1. Frontend Setup

Navigate to the frontend directory, install dependencies, and start the development server:

```bash
cd frontend
npm install
# or
pnpm install

npm run dev
# or
pnpm run dev