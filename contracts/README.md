# Contracts Reference

This directory contains all Leo smart contracts for True Markets — a fully on-chain binary prediction market platform built on Aleo. All markets are binary (two outcomes only). User positions are held as private ZK records and never revealed on-chain.

---

## Contract Overview

| Contract | Program ID | Role |
|---|---|---|
| `test_usdcx_stablecoin` | `test_usdcx_stablecoin.aleo` | Public USDCx collateral token |
| `true_optimistic_oracle_v3` | `true_optimistic_oracle_v3.aleo` | Optimistic dispute-based oracle |
| `true_prediction_market_v4` | `true_prediction_market_v4.aleo` | Core binary AMM market |
| `true_market_launchpad_v3` | `true_market_launchpad_v3.aleo` | Pre-market community liquidity |
| `true_private_p2p_v3` | `true_private_p2p_v3.aleo` | Private head-to-head binary bets |

### Dependency Graph

```
test_usdcx_stablecoin
        │
        ├─── true_optimistic_oracle_v3
        │              │
        └─── true_prediction_market_v4  (imports oracle + token)
                       │
                       └─── true_market_launchpad_v3  (calls create_market_from_launchpad)

test_usdcx_stablecoin
        │
        └─── true_private_p2p_v3  (standalone — no oracle dependency)
```

---

## `test_usdcx_stablecoin`

**Path:** [`test_usdcx_stablecoin/src/main.leo`](./test_usdcx_stablecoin/src/main.leo)

A public ERC-20 style token used as collateral across all modules on Aleo Testnet. All balances are public mappings. The token uses 6 decimal places (`1 USDCx = 1_000_000` atomic units).

### Mappings

| Mapping | Key | Value |
|---|---|---|
| `account` | `address` | `u128` public balance |
| `approvals` | `field` (hash of owner+spender) | `u128` approved spend limit |

### Functions

| Function | Access | Description |
|---|---|---|
| `mint_public` | Open | Mints tokens to a public address. Used for the faucet. |
| `transfer_public` | Open | Moves tokens between public balances. |
| `approve_public` | Open | Grants a spender an allowance from the caller's balance. Must be called by users before any contract can pull their USDCx. |
| `transfer_from_public` | Open (called by contracts) | Pulls tokens from an approved address into the calling program. Used by all other contracts. |

### Token Decimals

```
1 USDCx   =     1_000_000 atomic units
10 USDCx  =    10_000_000 atomic units
100 USDCx =   100_000_000 atomic units
```

---

## `true_optimistic_oracle_v3`

**Path:** [`true_optimistic_oracle/src/main.leo`](./true_optimistic_oracle/src/main.leo)

An optimistic dispute-resolution oracle for binary markets. The "optimistic" design means outcomes are assumed correct unless challenged. A proposer posts a bond. A 10-block liveness window opens. If no one disputes, the proposal finalizes automatically. If disputed, a designated oracle address resolves the tie and the winner takes both bonds.

### Mappings

| Mapping | Key | Value |
|---|---|---|
| `market_bonds` | `field` (market_id) | `u64` required bond amount |
| `market_oracles` | `field` (market_id) | `address` designated oracle |
| `proposals` | `field` (market_id) | `Proposal` struct |
| `proposal_heights` | `field` (market_id) | `u32` block height when proposed |

### Private Record

```leo
record ResolutionRecord {
    owner: address,
    market_id: field,
    winning_outcome: u8,    // 0 = Outcome A wins, 1 = Outcome B wins
}
```

This record is minted to the caller of `finalize_outcome` or `resolve_dispute`. It is consumed by `true_prediction_market_v4::resolve_market` to finalize the on-chain market state.

### Functions

| Function | Who calls | Description |
|---|---|---|
| `initialize_market` | Called by `true_prediction_market_v4::create_market` | Registers the bond amount and oracle address for a market. Can only be called once per market ID. |
| `propose_outcome` | Oracle or any address | Posts a USDCx bond and proposes an outcome (`0` = A wins, `1` = B wins). Bond is transferred from caller to the oracle program. Only one proposal per market at a time. |
| `dispute_outcome` | Any challenger | Posts an equal USDCx bond within 10 blocks of the proposal. Marks the proposal as disputed. |
| `finalize_outcome` | Anyone | Finalizes an undisputed proposal after the liveness window. Returns bond to proposer. Mints a `ResolutionRecord` to the caller. Requires: not disputed AND `block.height > proposal_height + 10`. |
| `resolve_dispute` | Designated oracle address only | Resolves a disputed proposal. Winning side (proposer or challenger) receives `2x bond`. Mints a `ResolutionRecord` to the caller. |

### Outcome Encoding

| Value | Meaning |
|---|---|
| `0u8` | Outcome A wins |
| `1u8` | Outcome B wins |

### Liveness Window

```
LIVENESS_PERIOD = 10 blocks

Challenge must arrive at:  block.height <= proposal_height + 10
Finalization allowed at:   block.height >  proposal_height + 10
```

---

## `true_prediction_market_v4`

**Path:** [`true_prediction_market1/src/main.leo`](./true_prediction_market1/src/main.leo)

The core binary AMM prediction market. Every market has exactly two outcomes (A and B). Liquidity is seeded equally on both sides. The AMM uses a constant-product formula (`shares_a × shares_b = k`) to price shares. Positions are held as fully private ZK records — outcome, share count, and owner are never visible on-chain.

### Data Structures

```leo
struct Market {
    creator: address,
    closes_at: u32,         // Block height when trading stops
    is_resolved: bool,
    winning_outcome: u8,    // 0=A, 1=B, 2=unresolved
    liquidity: u64,         // Seed liquidity in atomic USDCx
}

struct Pool {
    shares_a: u64,          // Shares representing Outcome A
    shares_b: u64,          // Shares representing Outcome B
}

record Position {
    owner: address,         // PRIVATE — only visible to record holder
    market_id: field,       // PRIVATE
    outcome: u8,            // PRIVATE — 0=A, 1=B
    shares: u64,            // PRIVATE
}
```

### Mappings

| Mapping | Key | Value | Visibility |
|---|---|---|---|
| `markets` | `field` (market_id) | `Market` struct | Public |
| `pools` | `field` (market_id) | `Pool` struct | Public |
| `configured_launchpad` | `u8` (slot 0) | `address` | Public |

### Functions

#### Market Lifecycle

| Function | Caller | Description |
|---|---|---|
| `set_launchpad` | Anyone (one-time only) | Registers the trusted launchpad address. Once set, cannot be changed. Must be called before `create_market_from_launchpad` ever executes. |
| `create_market` | Anyone | Creates a binary market. Pulls `initial_liquidity` USDCx from caller via `transfer_from_public`. Seeds the pool with `shares_a = shares_b = initial_liquidity`. Calls `true_optimistic_oracle_v3::initialize_market` to register the oracle bond. |
| `create_market_from_launchpad` | Launchpad contract only | Same as `create_market` but called by the launchpad. The `creator` field is passed explicitly (not `self.caller`). Verifies that `self.caller == configured_launchpad`. |
| `resolve_market` | Anyone with a `ResolutionRecord` | Consumes a `ResolutionRecord` from the oracle and marks the market resolved with a winning outcome. |

#### Trading

| Function | Caller | Returns | Description |
|---|---|---|---|
| `quote_buy` | Frontend (read-only) | `BuyQuote` | Computes expected shares out for a given USDCx amount and outcome. No state change. |
| `quote_sell` | Frontend (read-only) | `SellQuote` | Computes expected USDCx out for a given share amount and outcome. No state change. |
| `buy_private` | Any wallet | `(Position, Final)` | Buys outcome shares. Pulls USDCx from caller. Returns a private `Position` record. Enforces slippage via `min_shares_out`. The caller must supply the current `expected_shares_a` and `expected_shares_b` snapshot because private record outputs are computed before the finalization block reads the public pool mapping. |
| `sell_private` | Position record holder | `(Position, Final)` | Sells shares from a `Position` record. Returns USDCx to caller and a remainder `Position` record with `shares - shares_to_sell`. Enforces slippage via `min_collateral_out`. |
| `claim_private` | Position record holder | `(Position, Final)` | After resolution, redeems winning shares 1:1 for USDCx. Losing shares cannot be claimed. |

#### Privacy Record Management

These functions touch no public state. They only consume and produce private records, breaking on-chain linkability between transactions.

| Function | Description |
|---|---|
| `merge_positions` | Merges two `Position` records for the same market+outcome into one. An observer sees 2 records consumed, 1 produced — but cannot determine the combined size. Use to consolidate multiple buys. |
| `split_position` | Splits a `Position` into two smaller records. Hides position size before a partial sell. The chain sees 1 record consumed, 2 produced. |
| `transfer_position` | Transfers a `Position` to a new `recipient` address. Enables OTC position trades. The market, outcome, and share count are never revealed. |
| `shield_position` | Re-mints a `Position` to yourself with a fresh nonce. Breaks the link between the original buy transaction and a future sell transaction. Analogous to a Zcash self-transfer. |

### AMM Pricing Formula

The pool maintains `shares_a × shares_b = k` (constant product).

**Buying Outcome A:**
```
k            = shares_a × shares_b
new_shares_b = shares_b + amount_in
new_shares_a = k / new_shares_b
shares_out   = shares_a − new_shares_a
```

**Buying Outcome B** is symmetric (add `amount_in` to `shares_a` side).

**Selling Outcome A:**
```
k              = shares_a × shares_b
new_shares_a   = shares_a + shares_to_sell
new_shares_b   = k / new_shares_a
collateral_out = shares_b − new_shares_b
```

Slippage is enforced in the finalization block. The caller passes expected pool snapshots upfront; if another transaction moved the pool between quote time and finalization, the assertion `pool.shares_a == expected_shares_a` fails and the transaction reverts.

### Outcome Encoding

| Value | Meaning |
|---|---|
| `0u8` | Outcome A |
| `1u8` | Outcome B |
| `2u8` | `NO_WINNER` — market unresolved |

---

## `true_market_launchpad_v3`

**Path:** [`true_market_launchpad/src/main.leo`](./true_market_launchpad/src/main.leo)

A standalone community liquidity bootstrapping module for upcoming binary markets. Community members contribute USDCx privately before a market exists. Once the target pool is reached (or the close block arrives), anyone can activate the round. The round creator then calls `launch_market` to atomically transfer the accumulated USDCx into a new binary market.

### Data Structures

```leo
struct LaunchRound {
    creator: address,
    closes_at: u32,             // Block height when contributions stop
    target_liquidity: u64,      // Goal in atomic USDCx
    total_liquidity: u64,       // Currently committed
    contribution_count: u32,    // Number of contributions
    is_live: bool,              // True after activate_round succeeds
    is_market_launched: bool,   // True after launch_market succeeds
    launched_market_id: field,  // The market_id once launched
}

record LaunchPosition {
    owner: address,             // PRIVATE
    round_id: field,            // PRIVATE
    amount: u64,                // PRIVATE — contribution size hidden
}
```

### Mappings

| Mapping | Key | Value | Visibility |
|---|---|---|---|
| `rounds` | `field` (round_id) | `LaunchRound` struct | Public |

### Functions

| Function | Caller | Description |
|---|---|---|
| `create_round` | Anyone | Creates a new launchpad round. The `round_id` must not already exist. `closes_at` must be a future block. `target_liquidity` must be > 0. |
| `provide_liquidity_private` | Any contributor | Pulls USDCx from caller via `transfer_from_public`. Returns a private `LaunchPosition` record. Only allowed while `is_live == false` and `block.height < closes_at`. |
| `withdraw_liquidity_private` | `LaunchPosition` holder | Returns USDCx from the position to the caller. Decrements `total_liquidity` on the round. Only allowed while `is_live == false` and `block.height < closes_at`. |
| `activate_round` | Anyone | Flips `is_live = true`. Requires: `total_liquidity >= target_liquidity` OR `block.height >= closes_at`. Round must have > 0 liquidity. |
| `launch_market` | Round creator only | Transfers `total_liquidity` USDCx to a market adapter address, then calls `true_prediction_market_v4::create_market_from_launchpad` to create the binary market. Sets `is_market_launched = true` and records the `launched_market_id`. |

### Round Lifecycle

```
create_round
     │
     ▼
[Contributions open]  ──►  provide_liquidity_private (returns LaunchPosition record)
     │                      withdraw_liquidity_private (PreLive only)
     ▼
activate_round  (requires total >= target OR block >= closes_at)
     │
     ▼
[Round is live — contributions closed]
     │
     ▼
launch_market  (creator only — deploys binary market from pool)
     │
     ▼
[Binary market live on true_prediction_market_v4]
```

### Prerequisites

`true_prediction_market_v4::set_launchpad` must be called with this launchpad's address **before** any `launch_market` call. This is a one-time operation on the market contract that authorizes the launchpad as the sole trusted caller of `create_market_from_launchpad`.

---

## `true_private_p2p_v3`

**Path:** [`true_private_p2p/src/main.leo`](./true_private_p2p/src/main.leo)

A standalone private head-to-head binary betting module. Two parties bet on opposite outcomes using a **commitment scheme**. The maker's chosen outcome is hidden from observers — only a `BHP256` hash of `(maker, market_id, outcome, salt)` is stored on-chain. When the taker accepts, they supply the preimage as a private input; the circuit verifies it matches the hash before recording the match.

### Data Structures

```leo
struct OfferState {
    maker: address,
    taker: address,
    market_id: field,
    stake: u64,             // USDCx per side (both sides put in equal stake)
    commitment: field,      // BHP256::hash(OfferSecret) — hides maker's outcome
    is_open: bool,
    is_matched: bool,
    maker_claimed: bool,
    taker_claimed: bool,
}

struct OfferSecret {        // Never stored on-chain — only its hash is
    maker: address,
    market_id: field,
    outcome: u8,            // Maker's chosen outcome (PRIVATE)
    salt: field,            // Random nonce chosen by maker (PRIVATE)
}
```

### Mappings

| Mapping | Key | Value | Visibility |
|---|---|---|---|
| `markets` | `field` (market_id) | P2P `Market` struct | Public |
| `offers` | `field` (offer_id) | `OfferState` struct | Public |

### Functions

#### Market Management

| Function | Caller | Description |
|---|---|---|
| `create_market` | Anyone | Creates a P2P binary market with a designated oracle address and a close block. The creator is recorded as `creator`. |
| `resolve_market` | Designated oracle only | Sets `is_resolved = true` and `winning_outcome`. Can only be called at or after `closes_at`. |
| `cancel_market` | Market creator only | Marks the market as resolved with `winning_outcome = CANCELED (3u8)`. Either side can then claim a full refund. |

#### Offer Lifecycle

| Function | Caller | Private inputs | Description |
|---|---|---|---|
| `create_offer_private` | Maker | `outcome: u8`, `salt: field` | Posts a USDCx stake to the contract. Stores only the `BHP256` hash of `(maker, market_id, outcome, salt)` on-chain. The offer is open for matching. |
| `cancel_offer_private` | Maker | `outcome: u8`, `salt: field` | Cancels an unmatched open offer. Verifies commitment matches preimage. Returns stake to maker. |
| `accept_offer_private` | Taker | `maker: address`, `outcome: u8`, `salt: field` | Taker provides the maker's preimage as private inputs. The circuit computes `BHP256::hash(secret)` and verifies it matches the stored `commitment`. If valid, the match is recorded, both stakes are held, and `is_matched = true`. |

#### Claiming and Refunds

| Function | Caller | Private inputs | Description |
|---|---|---|---|
| `claim_maker_private` | Maker | `outcome: u8`, `salt: field` | After resolution: if `winning_outcome == maker's outcome`, pays out `2x stake` to maker. |
| `claim_taker_private` | Taker | `maker: address`, `outcome: u8`, `salt: field` | After resolution: if the taker's side won (opposite of maker's outcome), pays out `2x stake` to taker. |
| `refund_maker_private` | Maker | `outcome: u8`, `salt: field` | After cancellation: returns `stake` to maker. |
| `refund_taker_private` | Taker | `maker: address`, `outcome: u8`, `salt: field` | After cancellation: returns `stake` to taker. |

### Commitment Scheme

The commitment hides the maker's outcome from everyone except the taker (who receives it off-chain):

```
commitment = BHP256::hash({ maker, market_id, outcome, salt })
```

When `accept_offer_private` is called, the taker supplies `(maker, market_id, outcome, salt)` as **private** circuit inputs. The circuit verifies:
```
BHP256::hash(supplied_secret) == stored_commitment
```

If the hash doesn't match, the transaction fails. This means:
- No observer can determine which outcome the maker chose
- The taker cannot lie about the maker's outcome (the hash prevents it)
- The salt prevents rainbow table attacks on the 2-outcome space

### Outcome Encoding (P2P)

| Value | Meaning |
|---|---|
| `0u8` | Outcome A |
| `1u8` | Outcome B |
| `2u8` | `UNRESOLVED` |
| `3u8` | `CANCELED` |

---

## Deployment Checklist

### 1. Token (required by all)

```bash
# Deploy once — shared by all other contracts
leo deploy test_usdcx_stablecoin
```

No setup calls needed.

### 2. Oracle (required by market)

```bash
leo deploy true_optimistic_oracle_v3
```

No setup calls needed. The market contract initializes per-market state by calling `initialize_market` during `create_market`.

### 3. Core Market

```bash
leo deploy true_prediction_market_v4
```

**One-time setup — authorize the launchpad:**
```bash
# Only needed if deploying the launchpad stack
# Can only be called once — there is no undo
leo execute true_prediction_market_v4 set_launchpad <launchpad_program_address>
```

### 4. Launchpad (optional)

```bash
leo deploy true_market_launchpad_v3
```

Requires Step 3's `set_launchpad` call to have been made with this contract's address.

Create rounds after deployment:
```bash
leo execute true_market_launchpad_v3 create_round <round_id>field <closes_at>u32 <target>u64
```

### 5. P2P (optional, fully standalone)

```bash
leo deploy true_private_p2p_v3
```

No setup calls needed. Completely independent of the oracle and market stack.

---

## Required User Approvals

Every contract that moves USDCx calls `test_usdcx_stablecoin::transfer_from_public`. This requires the user to have granted an allowance first.

| Module | User must approve | Approved address |
|---|---|---|
| AMM Market (buy) | Before `buy_private` | `true_prediction_market_v4.aleo` address |
| Launchpad (contribute) | Before `provide_liquidity_private` | `true_market_launchpad_v3.aleo` address |
| P2P (create offer) | Before `create_offer_private` | `true_private_p2p_v3.aleo` address |
| P2P (accept offer) | Before `accept_offer_private` | `true_private_p2p_v3.aleo` address |

Frontend approval call:
```
test_usdcx_stablecoin::approve_public(spender_address, amount_u128)
```

---

## Private Records Reference

| Record | Minted by | Consumed by | What it holds |
|---|---|---|---|
| `Position` | `buy_private` | `sell_private`, `claim_private`, `merge_positions`, `split_position`, `transfer_position`, `shield_position` | owner, market_id, outcome, shares |
| `LaunchPosition` | `provide_liquidity_private` | `withdraw_liquidity_private` | owner, round_id, amount |
| `ResolutionRecord` | `finalize_outcome`, `resolve_dispute` | `resolve_market` on the prediction market | owner, market_id, winning_outcome |

All records are encrypted in the user's Aleo wallet. They are only readable after local decryption with the wallet's view key. No on-chain observer can see the record contents.

---

## Testnet Program IDs

| Contract | Deployed ID |
|---|---|
| USDCx token | `test_usdcx_stablecoin.aleo` |
| Oracle | `true_optimistic_oracle_v3.aleo` |
| Binary AMM market | `true_prediction_market_v4.aleo` |
| Launchpad | `true_market_launchpad_v3.aleo` |
| P2P | `true_private_p2p_v3.aleo` |

> The source folder for the market contract is `true_prediction_market1/` — the deployed program ID is `true_prediction_market_v4.aleo`. Always refer to `program.json` in each folder for the canonical deployed name.

---

## Frontend Environment Variables

```env
NEXT_PUBLIC_MARKET_PROGRAM_ID=true_prediction_market_v4.aleo
NEXT_PUBLIC_LAUNCHPAD_PROGRAM_ID=true_market_launchpad_v3.aleo
NEXT_PUBLIC_LAUNCHPAD_ADAPTER_ADDRESS=aleo1...   # Address receiving USDCx in launch_market
NEXT_PUBLIC_P2P_PROGRAM_ID=true_private_p2p_v3.aleo
NEXT_PUBLIC_P2P_SPENDER_ADDRESS=aleo1...          # = P2P program address
NEXT_PUBLIC_MARKET_SPENDER_ADDRESS=aleo1...       # = market program address
```
