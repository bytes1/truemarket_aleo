# True Markets

True Markets is a fully on-chain binary prediction market platform built on the Aleo blockchain. Every market is a binary Yes/No question. Positions are held as private ZK records — your holdings, trade sizes, and which outcome you bet on are never revealed on-chain. All settlement logic is enforced by smart contracts with no admin keys.

---

## What Is a Binary Prediction Market

A binary market has exactly two outcomes: **Outcome A** (e.g. YES) and **Outcome B** (e.g. NO). Users buy shares in one outcome using USDCx. Share prices are determined by an AMM (Automated Market Maker) using a constant-product formula. If you hold shares in the winning outcome when the market resolves, you redeem them 1:1 for USDCx. Losing shares are worth zero.

Example: _"Will ETH reach $6,500 before BTC reaches $140K?"_
- Buy YES shares if you believe ETH gets there first
- Buy NO shares if you believe BTC gets there first
- Oracle resolves the outcome after the close block
- Winners claim their USDCx

---

## Why Aleo

Aleo uses zero-knowledge proofs to let users hold and trade positions without revealing:
- **Which outcome they hold** (YES or NO)
- **How many shares they own**
- **The relationship between their buy and sell transactions**

The market AMM pool balances are public. Individual positions are fully private.

---

## Architecture Overview

```
true_markets/
├── contracts/
│   ├── test_usdcx_stablecoin/          # Public USDCx token (ERC-20 style)
│   ├── true_optimistic_oracle_v3/      # Optimistic dispute-based oracle
│   ├── true_prediction_market_v4/      # Core binary AMM market
│   ├── true_market_launchpad_v3/       # Pre-market community liquidity
│   └── true_private_p2p_v3/            # Private head-to-head binary bets
└── frontend/
    ├── app/                            # Next.js app router pages
    ├── components/                     # UI components
    └── lib/                            # Data, utilities, market helpers
```

### Contract Dependency Graph

```
test_usdcx_stablecoin
        │
        ├── true_optimistic_oracle_v3  (reads USDCx for bond payments)
        │           │
        └── true_prediction_market_v4  (imports oracle + token)
                    │
                    └── true_market_launchpad_v3  (calls create_market_from_launchpad)

test_usdcx_stablecoin
        │
        └── true_private_p2p_v3  (standalone, no oracle dependency)
```

---

## Contracts

### `test_usdcx_stablecoin`

A public ERC-20 style token deployed on Aleo Testnet. Used as collateral across all modules.

Key functions:
- `transfer_public` — move tokens between public balances
- `transfer_from_public` — spend on behalf of an approved address
- `approve_public` — grant a spender allowance

All other contracts call into this token to move funds. Users must `approve_public` before any contract can pull USDCx from their account.

---

### `true_optimistic_oracle_v3`

An optimistic dispute resolution oracle. Anyone can propose a binary market outcome by posting a bond. A challenger has a short **liveness window** (10 blocks) to post an equal bond and dispute the proposal. After the window closes without a dispute, the outcome finalizes. If disputed, a designated oracle address breaks the tie and the winner gets both bonds.

**Mappings:**
| Mapping | Key | Value |
|---|---|---|
| `market_bonds` | `field` (market ID) | `u64` bond amount |
| `market_oracles` | `field` (market ID) | `address` designated oracle |
| `proposals` | `field` (market ID) | `Proposal` struct |
| `proposal_heights` | `field` (market ID) | `u32` block when proposed |

**Functions:**
| Function | Who calls it | What it does |
|---|---|---|
| `initialize_market` | Called by `true_prediction_market_v4` during market creation | Registers the bond amount and oracle address for a market |
| `propose_outcome` | Oracle (or any address) | Posts a bond and proposes an outcome (0 = A wins, 1 = B wins) |
| `dispute_outcome` | Any challenger | Posts equal bond within 10 blocks to flag a dispute |
| `finalize_outcome` | Anyone | Finalizes undisputed proposal after liveness window; returns bond to proposer; mints a `ResolutionRecord` |
| `resolve_dispute` | Designated oracle address | Breaks disputed tie; winning side gets 2x bond |

The `ResolutionRecord` is a private record passed into `true_prediction_market_v4::resolve_market` to finalize the market state.

---

### `true_prediction_market_v4`

The core binary AMM market contract. Every market is a binary Yes/No pair seeded with equal liquidity on both sides. The AMM uses constant-product pricing (`shares_a × shares_b = k`).

**Private record:**
```leo
record Position {
    owner: address,
    market_id: field,
    outcome: u8,   // 0 = Outcome A, 1 = Outcome B
    shares: u64,
}
```
This record is held in the user's wallet, encrypted. Nobody on-chain can see the owner, outcome, or share count.

**Public mappings:**
| Mapping | Key | Value |
|---|---|---|
| `markets` | `field` (market ID) | `Market` struct (creator, closes_at, is_resolved, winning_outcome, liquidity) |
| `pools` | `field` (market ID) | `Pool` struct (shares_a, shares_b) |
| `configured_launchpad` | `u8` (slot 0) | `address` of the trusted launchpad contract |

**Functions:**

| Function | Inputs | Description |
|---|---|---|
| `create_market` | market_id, closes_at, initial_liquidity, bond_amount | Anyone creates a binary market. Pulls USDCx from caller, seeds pool with equal shares on both sides, registers oracle bond. |
| `create_market_from_launchpad` | market_id, creator, closes_at, initial_liquidity, bond_amount | Called only by the configured launchpad address. Bootstraps a market from community-pooled liquidity. |
| `buy_private` | market_id, outcome, amount, owner, expected_shares_a, expected_shares_b, min_shares_out | Buys shares in one outcome. Returns a private `Position` record. Pulls USDCx from caller's public balance. Slippage is enforced by `min_shares_out`. |
| `sell_private` | position (record), expected_shares_a, expected_shares_b, shares_to_sell, min_collateral_out | Consumes a `Position` record. Returns USDCx to the caller plus a remainder `Position` record with remaining shares. |
| `resolve_market` | resolution (ResolutionRecord from oracle) | Marks a market as resolved. Requires a valid `ResolutionRecord` from the oracle. |
| `claim_private` | position (record), shares_to_claim | Redeems winning shares 1:1 for USDCx after resolution. |
| `merge_positions` | position_a, position_b | Merges two records for the same market+outcome into one — breaks linkability between buys. |
| `split_position` | position, split_amount | Splits one record into two — hides position size before selling. |
| `transfer_position` | position, recipient | OTC private position transfer. |
| `shield_position` | position | Re-mints record to self with a fresh nonce — breaks the link between a buy tx and a future sell tx. |

**AMM pricing (constant-product):**

Buying Outcome A (shares_a):
```
k = shares_a × shares_b
new_shares_b = shares_b + amount
shares_bought = shares_a - (k / new_shares_b)
```

Buying Outcome B (shares_b) is symmetric. The caller passes the expected pool snapshot because private record outputs are generated before the finalization block reads public mappings.

---

### `true_market_launchpad_v3`

A standalone pre-market liquidity bootstrapping module. A round creator targets a liquidity amount and close block. Community members contribute USDCx privately and receive a private `LaunchPosition` record. Once the target is hit or the close block is reached, anyone can call `activate_round`. The round creator then calls `launch_market` to deploy the accumulated liquidity as a real binary market.

**Private record:**
```leo
record LaunchPosition {
    owner: address,
    round_id: field,
    amount: u64,
}
```

**Public mapping:**
| Mapping | Key | Value |
|---|---|---|
| `rounds` | `field` (round ID) | `LaunchRound` struct |

**`LaunchRound` struct fields:**
| Field | Type | Description |
|---|---|---|
| `creator` | `address` | Who created the round |
| `closes_at` | `u32` | Block height when contributions stop |
| `target_liquidity` | `u64` | Goal in atomic USDCx units |
| `total_liquidity` | `u64` | Currently committed |
| `contribution_count` | `u32` | Number of unique contributions |
| `is_live` | `bool` | Whether round has been activated |
| `is_market_launched` | `bool` | Whether market has been launched from this round |
| `launched_market_id` | `field` | The market_id if launched |

**Functions:**

| Function | Who calls | Description |
|---|---|---|
| `create_round` | Anyone | Registers a new launchpad round with target liquidity and close block. Round ID must not already exist. |
| `provide_liquidity_private` | Any contributor | Pulls USDCx from caller's public balance into the launchpad. Returns a private `LaunchPosition` record. Only allowed while round is not yet live. |
| `withdraw_liquidity_private` | Position holder | Returns USDCx to caller from their position. Decrements round's total. Only allowed before round is live. |
| `activate_round` | Anyone | Flips `is_live = true`. Requires `total_liquidity >= target_liquidity` OR `block.height >= closes_at`. |
| `launch_market` | Round creator | Transfers accumulated USDCx to a market adapter address and calls `true_prediction_market_v4::create_market_from_launchpad` to create the binary market. |

> **Important:** `launch_market` requires the market program's `configured_launchpad` to already be set to this launchpad's address via a one-time `set_launchpad` call on `true_prediction_market_v4`.

---

### `true_private_p2p_v3`

A standalone private head-to-head betting module. Two parties bet on opposite sides of a binary market using a commitment scheme (BHP256 hash). The maker's outcome is hidden from observers — only the commitment hash is stored on-chain. When the taker accepts, they supply the preimage to verify the commitment, and the match is recorded. After resolution, each side claims or gets refunded.

**Public mappings:**
| Mapping | Key | Value |
|---|---|---|
| `markets` | `field` (market ID) | P2P `Market` struct |
| `offers` | `field` (offer ID) | `OfferState` struct |

**`OfferState` fields:**
| Field | Description |
|---|---|
| `maker` | Creator of the offer |
| `taker` | Matched counterparty |
| `market_id` | Which binary market |
| `stake` | USDCx amount per side |
| `commitment` | BHP256 hash of (maker, market_id, outcome, salt) — hides the maker's outcome |
| `is_open` | Whether offer is still available to match |
| `is_matched` | Whether a taker accepted |
| `maker_claimed` / `taker_claimed` | Payout claimed flags |

**Functions:**

| Function | Description |
|---|---|
| `create_market` | Creates a P2P market with a designated oracle and close block |
| `create_offer_private` | Posts a private offer. Maker supplies outcome and salt as private inputs — only the commitment hash lands on-chain |
| `cancel_offer_private` | Maker cancels an unmatched offer and gets stake back |
| `accept_offer_private` | Taker supplies the maker's preimage to verify the commitment, then matches the offer |
| `resolve_market` | Oracle resolves to outcome 0 or 1 |
| `cancel_market` | Market creator cancels the market (sets outcome to CANCELED = 3) |
| `claim_maker_private` | Winning maker claims `2x stake` |
| `claim_taker_private` | Winning taker claims `2x stake` |
| `refund_maker_private` | Maker reclaims stake on a canceled market |
| `refund_taker_private` | Taker reclaims stake on a canceled market |

The maker's outcome is private. The chain sees a `commitment` field. When the taker calls `accept_offer_private`, they provide the maker's `(maker_address, market_id, outcome, salt)` as private inputs — the circuit verifies `BHP256::hash(secret) == commitment` before proceeding.

---

## Frontend

### Pages

| Route | Description |
|---|---|
| `/market` | Browse all binary markets |
| `/market/[id]` | Market detail: price chart, resolution rules, trade panel |
| `/create` | Create a new binary market with custom outcomes and liquidity |
| `/launchpad` | View, contribute to, and activate community liquidity rounds |
| `/p2p` | Create and match private head-to-head binary bets |
| `/oracle` | Submit oracle resolutions and track disputes |
| `/leaderboard` | Top traders by claim volume |
| `/faucet` | Claim test USDCx for testnet demos |
| `/settings` | Wallet and app configuration |

### Market Data Storage

Market **economics** (pool balances, resolution state, close block) live on-chain in `true_prediction_market_v4` mappings.

Market **metadata** (title, description, outcome labels, category, source link) is **not stored on-chain**. It lives in two places:

1. **`frontend/lib/data.ts`** — hardcoded preset markets (curated by the team for demos)
2. **`localStorage`** under the key `true-markets.custom-markets` — markets created via the `/create` page

When a user creates a market, the frontend:
1. Executes `approve_public` + `create_market` on-chain
2. Saves the metadata (title, outcomes, description, source link) to `localStorage`
3. The market appears instantly in the UI via `mergeMarkets(hardcoded, stored)`

> **Limitation:** Custom market metadata only exists in the browser that created it. Sharing a market URL with another user will show the pool data but not the title or rules.

### Trade Flow (AMM)

```
User wants to buy YES on market #5

1. Frontend fetches pool state from chain (shares_a, shares_b)
2. Computes quote: shares_out = shares_a - (k / (shares_b + amount))
3. User approves USDCx: approve_public(market_program_address, amount)
4. User calls: buy_private(market_id=5field, outcome=0u8, amount, owner, shares_a, shares_b, min_shares_out)
5. Chain verifies pool snapshot matches, pulls USDCx, updates pool
6. A private Position record is minted to the user's wallet

User wants to sell:
1. User loads wallet records: requestRecords(market_program_id)
2. User decrypts a Position record: decrypt(ciphertext)
3. Frontend extracts market_id, outcome, shares
4. User calls: sell_private(position_record, shares_a, shares_b, shares_to_sell, min_collateral_out)
5. Chain verifies pool snapshot, burns the record, pays out USDCx, mints remainder record
```

---

## Setup and Running

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20.x |
| pnpm | 9.x |
| Leo | 3.4.0 |
| Aleo wallet | Compatible with `@provablehq/aleo-wallet-adaptor-react` |

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Available scripts:
```bash
pnpm dev      # Local development server
pnpm build    # Production build
pnpm start    # Serve production build
pnpm lint     # Check for lint errors
```

### Environment Variables

Create `frontend/.env.local`:

```env
# Core market contract
NEXT_PUBLIC_MARKET_PROGRAM_ID=true_prediction_market_v4.aleo

# Launchpad contract
NEXT_PUBLIC_LAUNCHPAD_PROGRAM_ID=true_market_launchpad_v3.aleo

# Address that receives USDCx during launch_market (market adapter/spender)
NEXT_PUBLIC_LAUNCHPAD_ADAPTER_ADDRESS=aleo1...

# P2P contract
NEXT_PUBLIC_P2P_PROGRAM_ID=true_private_p2p_v3.aleo

# P2P USDCx spender (usually = P2P program address)
NEXT_PUBLIC_P2P_SPENDER_ADDRESS=aleo1...

# Market program's address (for approve_public in buy flow)
NEXT_PUBLIC_MARKET_SPENDER_ADDRESS=aleo1...
```

---

## Deployment Order

### Step 1 — Token

```
deploy test_usdcx_stablecoin
```

### Step 2 — Oracle

```
deploy true_optimistic_oracle_v3
```
No setup calls needed.

### Step 3 — Market

```
deploy true_prediction_market_v4
```

One-time setup to authorize the launchpad:
```
call true_prediction_market_v4/set_launchpad <launchpad_program_address>
```
This can only be called once. It authorizes the launchpad to call `create_market_from_launchpad`.

### Step 4 — Launchpad (optional)

```
deploy true_market_launchpad_v3
```

Initialize launchpad rounds via `create_round` calls. Users can then contribute via the frontend. The launchpad must already be registered in the market contract (Step 3).

### Step 5 — P2P (optional, standalone)

```
deploy true_private_p2p_v3
```

Fully standalone. Does not depend on the oracle or market contract.

---

## Key User Flows

### Binary Market Trade

1. Browse `/market` → pick a market
2. Connect wallet
3. Select Outcome A or B, enter USDCx amount
4. Click **Buy (Private)** — wallet prompts two transactions (approve + buy)
5. A private `Position` record lands in your wallet
6. To sell: click Load Records → Decrypt → Sell

### Launchpad (Community Liquidity)

1. Browse `/launchpad` → pick a round
2. If round not initialized: click **Initialize Round**
3. Enter USDCx amount → click **Provide** (approve + provide transactions)
4. A private `LaunchPosition` record lands in your wallet
5. Once `total_liquidity >= target_liquidity` or close block passes: click **Activate**
6. Round creator clicks **Launch Market** to deploy the actual binary market

### P2P Bet

**Maker:**
1. Go to `/p2p` → fill in market, outcome, stake
2. Click **Create Offer** — your outcome is hashed, commitment stored on-chain
3. Copy the encrypted offer details and share with counterparty

**Taker:**
1. Paste the maker's offer details
2. Click **Accept** — circuit verifies the commitment; parties are matched
3. After oracle resolution: click **Claim** or **Refund**

### Oracle Resolution

1. Go to `/oracle` → find an unresolved market past its close block
2. Click **Propose Outcome** — post bond, select winning side
3. Wait 10 blocks — if no dispute: click **Finalize**
4. Pass the `ResolutionRecord` to **Resolve Market** on the market page

---

## Privacy Model

| What | Private? | Visible on-chain |
|---|---|---|
| Your position outcome (YES/NO) | ✅ YES | Only a commitment hash (P2P) or encrypted record (AMM) |
| Your share count | ✅ YES | Never |
| Your buy-to-sell link | ✅ YES (with shield/split) | Pool delta only |
| Pool share totals (shares_a, shares_b) | ❌ NO | Public mapping |
| Market resolution state | ❌ NO | Public mapping |
| Launchpad round totals | ❌ NO | Public mapping |
| P2P offer stake and match status | ❌ NO | Public mapping |

---

## Demo Script

For a clean end-to-end testnet demo:

1. Go to `/faucet` → claim test USDCx
2. Go to `/market` → open any live market
3. Buy a private position on Outcome A
4. Load wallet records → decrypt the Position record
5. Show that outcome and shares are only visible after local decryption
6. Sell part of the position
7. Go to `/launchpad` → contribute to an upcoming round
8. Decrypt the LaunchPosition record
9. Go to `/p2p` → create a private head-to-head offer
10. Open a second wallet → accept the offer
11. Resolve and claim

---

## Testnet Deployments

| Contract | Program ID |
|---|---|
| USDCx token | `test_usdcx_stablecoin.aleo` |
| Oracle | `true_optimistic_oracle_v3.aleo` |
| Binary AMM market | `true_prediction_market_v4.aleo` |
| Launchpad | `true_market_launchpad_v3.aleo` |
| P2P | `true_private_p2p_v3.aleo` |

> Program names in source may differ from deployed names if iterations were done locally. Always verify `program.json` for the canonical deployed ID before running transactions.
