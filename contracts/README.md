# Contracts Guide

This folder contains the onchain programs used by True Markets.

There are three independent stacks:

- the original market trading stack
- the standalone P2P betting stack
- the standalone launchpad stack

The standalone P2P and launchpad contracts do not change the original market contracts.

## Contract List

### `true_market_token`

Path: [`true_market_token/src/main.leo`](./true_market_token/src/main.leo)

Purpose:

- public token balance mapping
- minting
- direct transfers
- approvals
- `transfer_from_public`

Main transitions:

- `mint_public`
- `transfer_public`
- `approve_public`
- `transfer_from_public`

## `test_usdcx_stablecoin`

Path: [`test_usdcx_stablecoin/src/main.leo`](./test_usdcx_stablecoin/src/main.leo)

Purpose:

- acts as the USDCx-facing dependency expected by the adapters
- used by both the market adapter and launchpad adapter

Notes:

- this program is referenced as the token program in the frontend
- adapters call its public transfer and allowance-style transitions

## `usdcx_token_adapter`

Path: [`usdcx_token_adapter/src/main.leo`](./usdcx_token_adapter/src/main.leo)

Purpose:

- isolates market funding and payout token logic
- only the configured market program can pull from or push to users through this adapter

Main transitions:

- `set_market`
- `pull_from_user`
- `push_to_user`

Required setup after deployment:

1. deploy the adapter
2. deploy the market program
3. call `set_market` once with the deployed market address

Important:

- `set_market` is one-time only
- if you configure the wrong market address, redeploy the adapter

## `ture_prediction_market1`

Path: [`ture_prediction_market1/src/main.leo`](./ture_prediction_market1/src/main.leo)

Purpose:

- market creation
- AMM pool initialization
- buy and sell quote helpers
- private position creation and update
- market resolution and winner payout

Main data types:

- `Market`
- `Pool`
- `Position`
- `BuyQuote`
- `SellQuote`

Main transitions:

- `create_market`
- `quote_buy`
- `quote_sell`
- `buy_private`
- `sell_private`
- `resolve_market`
- `claim_winnings`

Operational notes:

- `create_market` pulls the initial liquidity from the creator through `usdcx_token_adapter`
- `buy_private` creates a private `Position` record
- `sell_private` consumes a `Position` record and returns a remainder record
- users must approve the token adapter before funding or trading

## `launchpad_usdcx_adapter`

Path: [`launchpad_usdcx_adapter/src/main.leo`](./launchpad_usdcx_adapter/src/main.leo)

Purpose:

- isolated token adapter for the standalone launchpad
- only the configured launchpad program can move USDCx through it

Main transitions:

- `set_launchpad`
- `pull_from_user`
- `push_to_user`

Required setup after deployment:

1. deploy the adapter
2. deploy the launchpad program
3. call `set_launchpad` once with the deployed launchpad address

Important:

- `set_launchpad` is one-time only
- if you configure the wrong launchpad address, redeploy the adapter

## `p2p_usdcx_adapter`

Path: [`p2p_usdcx_adapter/src/main.leo`](./p2p_usdcx_adapter/src/main.leo)

Purpose:

- isolated token adapter for private head-to-head bets
- only the configured P2P program can move USDCx through it

Main transitions:

- `set_p2p`
- `pull_from_user`
- `push_to_user`

Required setup after deployment:

1. deploy the adapter
2. deploy the P2P program
3. call `set_p2p` once with the deployed P2P address

Important:

- `set_p2p` is one-time only
- if you configure the wrong P2P address, redeploy the adapter

## `true_private_p2p`

Path: [`true_private_p2p/src/main.leo`](./true_private_p2p/src/main.leo)

Purpose:

- create private two-sided bet markets
- create private offer records in USDCx
- accept a shared private offer with the opposite side
- resolve, cancel, claim, and refund matched bets

Main data types:

- `Market`
- `BetOffer`
- `MatchedBet`

Main transitions:

- `create_market`
- `create_offer_private`
- `cancel_offer_private`
- `accept_offer_private`
- `resolve_market`
- `cancel_market`
- `claim_private`
- `refund_private`

Operational notes:

- creating an offer returns a private `BetOffer` record
- matching an offer consumes the offer and returns two private `MatchedBet` records
- the offer record must be shared off-chain with the counterparty
- creator resolves or cancels after market close
- users must approve the P2P adapter before creating or matching offers

## `true_market_launchpad`

Path: [`true_market_launchpad/src/main.leo`](./true_market_launchpad/src/main.leo)

Purpose:

- create pre-live launch rounds
- accept private liquidity contributions in USDCx
- return private launch position records
- allow pre-live withdrawals
- activate a round once it is ready

Main data types:

- `LaunchRound`
- `LaunchPosition`

Main transitions:

- `create_round`
- `provide_liquidity_private`
- `withdraw_liquidity_private`
- `activate_round`

Operational notes:

- each contribution returns a private `LaunchPosition` record
- the adapter handles actual token movement
- users must approve the launchpad adapter before contributing
- withdrawal is only allowed before the round becomes live

## Deployment Order

### Original market stack

Recommended order:

1. deploy `true_market_token` if needed for your environment
2. deploy or point to `test_usdcx_stablecoin`
3. deploy `usdcx_token_adapter`
4. deploy `ture_prediction_market1`
5. call `usdcx_token_adapter/set_market(market_address)`

### Standalone launchpad stack

Recommended order:

1. deploy or point to `test_usdcx_stablecoin`
2. deploy `launchpad_usdcx_adapter`
3. deploy `true_market_launchpad`
4. call `launchpad_usdcx_adapter/set_launchpad(launchpad_address)`

### Standalone P2P stack

Recommended order:

1. deploy or point to `test_usdcx_stablecoin`
2. deploy `p2p_usdcx_adapter`
3. deploy `true_private_p2p`
4. call `p2p_usdcx_adapter/set_p2p(p2p_address)`

## Required User Approvals

Before token movement can happen:

- market users must call `approve_public(adapter_address, amount)` for `usdcx_token_adapter`
- P2P users must call `approve_public(adapter_address, amount)` for `p2p_usdcx_adapter`
- launchpad users must call `approve_public(adapter_address, amount)` for `launchpad_usdcx_adapter`

Without approval, `pull_from_user` will fail because the adapter uses `transfer_from_public`.

## Launchpad Post-Deploy Checklist

Once the standalone launchpad contracts are live:

1. configure `launchpad_usdcx_adapter` with `set_launchpad`
2. create rounds with a future `closes_at` block height
3. choose `target_liquidity` in atomic token units
4. set the frontend environment:
   - `NEXT_PUBLIC_LAUNCHPAD_PROGRAM_ID`
   - `NEXT_PUBLIC_LAUNCHPAD_ADAPTER_ADDRESS`
5. make sure user wallets hold test USDCx
6. make sure users approve the adapter before contributing

## Units and Records

### Token units

The frontend currently treats USDCx with 6 decimals.

Examples:

- `1 USDCx = 1000000`
- `10 USDCx = 10000000`
- `100 USDCx = 100000000`

### Private records

Market trading produces:

- `Position` records from `ture_prediction_market1`

P2P betting produces:

- `BetOffer` records from `true_private_p2p`
- `MatchedBet` records from `true_private_p2p`

Launchpad contributions produce:

- `LaunchPosition` records from `true_market_launchpad`

These records are intended to be fetched from the wallet and decrypted client-side when needed.

## Frontend Integration Notes

The current frontend:

- reads P2P market state from the `markets` mapping
- reads launch rounds from the `rounds` mapping
- reads token balances from the token program mappings
- loads encrypted records from the wallet
- decrypts records only on explicit user action

If your deployed program names differ from local folder names, update the frontend constants or environment accordingly.
