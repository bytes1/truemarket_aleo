# True Markets

True Markets is an Aleo-based prediction market app with private position handling, AMM-style trading, and a standalone launchpad for community-funded pre-market liquidity.

This repository contains:

- a Next.js frontend for browsing markets, trading, decrypting private positions, and contributing launchpad liquidity
- a market contract stack for live prediction trading
- a separate launchpad contract stack for pre-live USDCx liquidity commitments

## What Is Included

### Frontend

The frontend lives in [`frontend/`](./frontend) and includes:

- market list and market detail pages
- private buy and sell flows
- wallet-based record loading and decryption
- a launchpad page for providing and withdrawing pre-live liquidity
- a faucet page and supporting dashboard pages
- an AI chat route for in-app assistance

### Contracts

The contracts live in [`contracts/`](./contracts) and are split into two independent stacks:

- market stack
  - `true_market_token`
  - `test_usdcx_stablecoin`
  - `usdcx_token_adapter`
  - `ture_prediction_market1`
- standalone launchpad stack
  - `launchpad_usdcx_adapter`
  - `true_market_launchpad`

The launchpad contracts are separate and do not modify the original market contracts.

## Repository Layout

```text
aleo/
|- contracts/
|  |- true_market_token/
|  |- test_usdcx_stablecoin/
|  |- usdcx_token_adapter/
|  |- ture_prediction_market1/
|  |- launchpad_usdcx_adapter/
|  |- true_market_launchpad/
|- frontend/
|  |- app/
|  |- components/
|  |- lib/
|- README.md
```

## Key User Flows

### Prediction Markets

Users can:

- browse markets
- inspect pool state and market detail pages
- approve USDCx spending
- buy private positions
- load wallet records
- decrypt current-market positions
- sell from a decrypted position record

### Launchpad

Users can:

- review upcoming launch rounds
- approve USDCx for the launchpad adapter
- provide private launch liquidity
- decrypt launch position records
- withdraw before the round goes live
- activate a round once the target or close condition is met

## Prerequisites

Recommended local versions:

- Node.js 20.x
- pnpm 9.x
- Leo 3.4.0
- an Aleo wallet compatible with `@provablehq/aleo-wallet-adaptor-react`

## Frontend Setup

From `frontend/`:

```bash
pnpm install
pnpm dev
```

Useful scripts:

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

## Frontend Environment

The current frontend uses these environment variables for the standalone launchpad:

- `NEXT_PUBLIC_LAUNCHPAD_PROGRAM_ID`
  - optional
  - defaults to `true_market_launchpad.aleo`
- `NEXT_PUBLIC_LAUNCHPAD_ADAPTER_ADDRESS`
  - required for the launchpad approve flow
  - should be set to the deployed `launchpad_usdcx_adapter.aleo` address

If you are using the AI chat route, make sure the model provider credentials required by your deployment are also configured in your runtime environment.

## Frontend Routes

Important pages:

- `/market`
- `/market/[id]`
- `/launchpad`
- `/faucet`
- `/leaderboard`
- `/settings`

## Contract Overview

For full contract details, read [`contracts/README.md`](./contracts/README.md).

High level summary:

- `true_market_token`: base public token logic
- `test_usdcx_stablecoin`: local ABI-facing token dependency used by adapters
- `usdcx_token_adapter`: adapter that only allows the configured market program to move USDCx
- `ture_prediction_market1`: AMM market logic for creating, buying, selling, resolving, and claiming
- `launchpad_usdcx_adapter`: adapter that only allows the configured launchpad program to move USDCx
- `true_market_launchpad`: standalone round creation, liquidity contribution, withdrawal, and activation

## Deployment Notes

### Market Stack

After deploying the original market stack:

1. deploy the adapter and market program
2. call `usdcx_token_adapter.aleo/set_market` once with the deployed market address
3. make sure users approve the adapter before market funding or trading flows

### Launchpad Stack

After deploying the standalone launchpad stack:

1. deploy the adapter and launchpad program
2. call `launchpad_usdcx_adapter.aleo/set_launchpad` once with the deployed launchpad address
3. create rounds with `create_round`
4. make sure users approve the launchpad adapter before contributing liquidity

## Notes About Program Names

Some frontend constants may point to a deployed program name that differs from the local source folder name you are editing. This is normal during iteration. Always verify the program name and deployed address used by your current environment before demoing.

## Suggested Demo Order

For a clean demo:

1. mint or fund a wallet with test USDCx
2. open `/market` and inspect a live market
3. buy a private position
4. decrypt the current-market record and show holdings
5. sell part of the position
6. open `/launchpad`
7. approve USDCx and provide launch liquidity
8. decrypt the launch position record

## Contracts Documentation

Use [`contracts/README.md`](./contracts/README.md) for:

- per-contract purpose
- deploy order
- required one-time setup calls
- token approval expectations
- launchpad-specific notes
