import test_usdcx_stablecoin.aleo;
import true_optimistic_oracle_v3.aleo;

program true_prediction_market_v3.aleo {
    struct Market {
        creator: address,
        closes_at: u32,
        is_resolved: bool,
        winning_outcome: u8,
        liquidity: u64,
    }

    struct Pool {
        shares_a: u64,
        shares_b: u64,
    }

    struct BuyQuote {
        next_shares_a: u64,
        next_shares_b: u64,
        shares_out: u64,
    }

    struct SellQuote {
        next_shares_a: u64,
        next_shares_b: u64,
        collateral_out: u64,
    }

    record Position {
        owner: address,
        market_id: field,
        outcome: u8,
        shares: u64,
    }

    const NO_WINNER: u8 = 2u8;
    const LAUNCHPAD_SLOT: u8 = 0u8;

    mapping markets: field => Market;
    mapping configured_launchpad: u8 => address;
    mapping pools: field => Pool;

    fn set_launchpad(public launchpad: address) -> Final {
        return final {
            assert(!Mapping::contains(configured_launchpad, LAUNCHPAD_SLOT));
            Mapping::set(configured_launchpad, LAUNCHPAD_SLOT, launchpad);
        };
    }

    
    // The constructor is configured to prevent upgrades.
    @noupgrade
     constructor() {}

    fn create_market(
        public market_id: field,
        public closes_at: u32,
        public initial_liquidity: u64,
        public bond_amount: u64
    ) -> Final {
        assert(initial_liquidity > 0u64);

        let funding: Final = test_usdcx_stablecoin.aleo::transfer_from_public(
            self.caller,
            self.address,
            initial_liquidity as u128
        );
        let creator: address = self.caller;
        
        let oracle_init: Final = true_optimistic_oracle_v3.aleo::initialize_market(market_id, bond_amount, creator);

        return final {
            assert(!Mapping::contains(markets, market_id));
            assert(closes_at > block.height);

            funding.run();
            oracle_init.run();

            let market: Market = Market {
                creator: creator,
                closes_at: closes_at,
                is_resolved: false,
                winning_outcome: NO_WINNER,
                liquidity: initial_liquidity,
            };
            Mapping::set(markets, market_id, market);

            let pool: Pool = Pool {
                shares_a: initial_liquidity,
                shares_b: initial_liquidity,
            };
            Mapping::set(pools, market_id, pool);
        };
    }

    fn create_market_from_launchpad(
        public market_id: field,
        public creator: address,
        public closes_at: u32,
        public initial_liquidity: u64,
        public bond_amount: u64
    ) -> Final {
        let caller: address = self.caller;
        let oracle_init: Final = true_optimistic_oracle_v3.aleo::initialize_market(market_id, bond_amount, creator);
        return final {
            let launchpad: address = Mapping::get(configured_launchpad, LAUNCHPAD_SLOT);
            assert(caller == launchpad);
            assert(initial_liquidity > 0u64);
            assert(!Mapping::contains(markets, market_id));
            assert(closes_at > block.height);

            oracle_init.run();

            let market: Market = Market {
                creator: creator,
                closes_at: closes_at,
                is_resolved: false,
                winning_outcome: NO_WINNER,
                liquidity: initial_liquidity,
            };
            Mapping::set(markets, market_id, market);

            let pool: Pool = Pool {
                shares_a: initial_liquidity,
                shares_b: initial_liquidity,
            };
            Mapping::set(pools, market_id, pool);
        };
    }

    fn quote_buy(
        public pool_shares_a: u64,
        public pool_shares_b: u64,
        public outcome: u8,
        public amount: u64
    ) -> BuyQuote {
        return compute_buy_quote(pool_shares_a, pool_shares_b, outcome, amount);
    }

    fn quote_sell(
        public pool_shares_a: u64,
        public pool_shares_b: u64,
        public outcome: u8,
        public shares_to_sell: u64
    ) -> SellQuote {
        return compute_sell_quote(pool_shares_a, pool_shares_b, outcome, shares_to_sell);
    }

    // The caller supplies the current pool snapshot because private record outputs
    // are created before the final block executes, while public mappings are readable in final logic.
    fn buy_private(
        public market_id: field,
        public outcome: u8,
        public amount: u64,
        private owner: address,
        public expected_shares_a: u64,
        public expected_shares_b: u64,
        public min_shares_out: u64
    ) -> (Position, Final) {
        let quote: BuyQuote = compute_buy_quote(expected_shares_a, expected_shares_b, outcome, amount);
        assert(quote.shares_out >= min_shares_out);

        let position: Position = Position {
            owner: owner,
            market_id: market_id,
            outcome: outcome,
            shares: quote.shares_out,
        };

        let funding: Final = test_usdcx_stablecoin.aleo::transfer_from_public(
            self.caller,
            self.address,
            amount as u128
        );
        
        return (
            position,
            final {
                let market: Market = Mapping::get(markets, market_id);
                assert(outcome <= 1u8);
                assert(amount > 0u64);
                assert(market.is_resolved == false);
                assert(block.height < market.closes_at);

                let pool: Pool = Mapping::get(pools, market_id);
                assert(pool.shares_a == expected_shares_a);
                assert(pool.shares_b == expected_shares_b);

                let k: u128 = (pool.shares_a as u128) * (pool.shares_b as u128);

                let new_b_if_0: u64 = pool.shares_b + amount;
                let new_a_if_0: u64 = (k / (new_b_if_0 as u128)) as u64;
                let shares_bought_if_0: u64 = pool.shares_a - new_a_if_0;

                let new_a_if_1: u64 = pool.shares_a + amount;
                let new_b_if_1: u64 = (k / (new_a_if_1 as u128)) as u64;
                let shares_bought_if_1: u64 = pool.shares_b - new_b_if_1;

                let next_shares_a: u64 = outcome == 0u8 ? new_a_if_0 : new_a_if_1;
                let next_shares_b: u64 = outcome == 0u8 ? new_b_if_0 : new_b_if_1;
                let shares_bought: u64 = outcome == 0u8 ? shares_bought_if_0 : shares_bought_if_1;
                assert(shares_bought > 0u64);

                funding.run();

                let updated_pool: Pool = Pool {
                    shares_a: next_shares_a,
                    shares_b: next_shares_b,
                };
                Mapping::set(pools, market_id, updated_pool);
            }
        );
    }

    fn sell_private(
        position: Position,
        public expected_shares_a: u64,
        public expected_shares_b: u64,
        public shares_to_sell: u64,
        public min_collateral_out: u64
    ) -> (Position, Final) {
        assert(position.owner == self.caller);
        assert(shares_to_sell > 0u64);
        assert(position.shares >= shares_to_sell);

        let quote: SellQuote = compute_sell_quote(
            expected_shares_a,
            expected_shares_b,
            position.outcome,
            shares_to_sell
        );
        assert(quote.collateral_out >= min_collateral_out);

        let remainder: Position = Position {
            owner: position.owner,
            market_id: position.market_id,
            outcome: position.outcome,
            shares: position.shares - shares_to_sell,
        };

        let payout: Final = test_usdcx_stablecoin.aleo::transfer_public(
            self.caller,
            quote.collateral_out as u128
        );
        
        let outcome: u8 = position.outcome;
        let market_id: field = position.market_id;

        return (
            remainder,
            final {
                let market: Market = Mapping::get(markets, market_id);
                assert(outcome <= 1u8);
                assert(shares_to_sell > 0u64);
                assert(market.is_resolved == false);
                assert(block.height < market.closes_at);

                let pool: Pool = Mapping::get(pools, market_id);
                assert(pool.shares_a == expected_shares_a);
                assert(pool.shares_b == expected_shares_b);

                let k: u128 = (pool.shares_a as u128) * (pool.shares_b as u128);

                let new_a_if_0: u64 = pool.shares_a + shares_to_sell;
                let new_b_if_0: u64 = (k / (new_a_if_0 as u128)) as u64;
                let collateral_out_if_0: u64 = pool.shares_b - new_b_if_0;

                let new_b_if_1: u64 = pool.shares_b + shares_to_sell;
                let new_a_if_1: u64 = (k / (new_b_if_1 as u128)) as u64;
                let collateral_out_if_1: u64 = pool.shares_a - new_a_if_1;

                let next_shares_a: u64 = outcome == 0u8 ? new_a_if_0 : new_a_if_1;
                let next_shares_b: u64 = outcome == 0u8 ? new_b_if_0 : new_b_if_1;
                let collateral_out: u64 = outcome == 0u8 ? collateral_out_if_0 : collateral_out_if_1;
                assert(collateral_out > 0u64);

                payout.run();

                let updated_pool: Pool = Pool {
                    shares_a: next_shares_a,
                    shares_b: next_shares_b,
                };
                Mapping::set(pools, market_id, updated_pool);
            }
        );
    }

    fn resolve_market(
        resolution: true_optimistic_oracle_v3.aleo::ResolutionRecord
    ) -> Final {
        let market_id: field = resolution.market_id;
        let winning_outcome: u8 = resolution.winning_outcome;
        
        return final {
            let market: Market = Mapping::get(markets, market_id);
            assert(market.is_resolved == false);
            assert(winning_outcome <= 1u8);

            let updated_market: Market = Market {
                creator: market.creator,
                closes_at: market.closes_at,
                is_resolved: true,
                winning_outcome: winning_outcome,
                liquidity: market.liquidity,
            };
            Mapping::set(markets, market_id, updated_market);
        };
    }

    fn claim_private(
        position: Position,
        shares_to_claim: u64
    ) -> (Position, Final) {
        assert(position.owner == self.caller);
        assert(shares_to_claim > 0u64);
        assert(position.shares >= shares_to_claim);

        let remainder: Position = Position {
            owner: position.owner,
            market_id: position.market_id,
            outcome: position.outcome,
            shares: position.shares - shares_to_claim,
        };

        let payout: Final = test_usdcx_stablecoin.aleo::transfer_public(
            self.caller,
            shares_to_claim as u128
        );
        let outcome: u8 = position.outcome;
        let market_id: field = position.market_id;
        
        return (
            remainder,
            final {
                let market: Market = Mapping::get(markets, market_id);
                assert(shares_to_claim > 0u64);
                assert(market.is_resolved == true);
                assert(market.winning_outcome == outcome);

                let pool: Pool = Mapping::get(pools, market_id);
                let updated_pool: Pool = Pool {
                    shares_a: outcome == 0u8 ? pool.shares_a - shares_to_claim : pool.shares_a,
                    shares_b: outcome == 1u8 ? pool.shares_b - shares_to_claim : pool.shares_b,
                };
                Mapping::set(pools, market_id, updated_pool);

                payout.run();
            }
        );
    }

    // ──────────────────────────────────────────────────
    //  PRIVACY-ENHANCING RECORD MANAGEMENT
    //  Pure private transitions — no finalization, no
    //  public state touched, fully shielded on-chain.
    // ──────────────────────────────────────────────────

    /// Merge two Position records for the same market+outcome into one.
    /// Breaks the linkability between multiple small buys.
    /// An observer sees two records consumed and one produced, but cannot
    /// determine the combined share count or which records were merged.
    fn merge_positions(
        position_a: Position,
        position_b: Position
    ) -> Position {
        assert(position_a.owner == self.caller);
        assert(position_b.owner == self.caller);
        assert(position_a.market_id == position_b.market_id);
        assert(position_a.outcome == position_b.outcome);

        return Position {
            owner: position_a.owner,
            market_id: position_a.market_id,
            outcome: position_a.outcome,
            shares: position_a.shares + position_b.shares,
        };
    }

    /// Split a Position record into two smaller records.
    /// Allows a user to fragment their holdings so that future sells
    /// don't reveal the full position size. The split amounts are
    /// private — the chain only sees one record consumed and two produced.
    fn split_position(
        position: Position,
        private split_amount: u64
    ) -> (Position, Position) {
        assert(position.owner == self.caller);
        assert(split_amount > 0u64);
        assert(split_amount < position.shares);

        let first: Position = Position {
            owner: position.owner,
            market_id: position.market_id,
            outcome: position.outcome,
            shares: split_amount,
        };

        let second: Position = Position {
            owner: position.owner,
            market_id: position.market_id,
            outcome: position.outcome,
            shares: position.shares - split_amount,
        };

        return (first, second);
    }

    /// Privately transfer a Position to a new owner.
    /// Enables OTC position trading without revealing the market,
    /// outcome, or share amount on-chain. The original record is
    /// consumed and a new record minted to the recipient — only
    /// the two parties know the transfer happened.
    fn transfer_position(
        position: Position,
        private recipient: address
    ) -> Position {
        assert(position.owner == self.caller);

        return Position {
            owner: recipient,
            market_id: position.market_id,
            outcome: position.outcome,
            shares: position.shares,
        };
    }

    /// "Shield" a position by re-minting it to yourself.
    /// This creates a fresh record with a new nonce, breaking the
    /// on-chain link between the old record (from a buy_private tx)
    /// and this new record. Analogous to a self-transfer in Zcash.
    /// Use this before selling to prevent observers from correlating
    /// your buy transaction with your sell transaction.
    fn shield_position(
        position: Position
    ) -> Position {
        assert(position.owner == self.caller);

        return Position {
            owner: position.owner,
            market_id: position.market_id,
            outcome: position.outcome,
            shares: position.shares,
        };
    }
}

// Helper functions placed outside program
fn compute_buy_quote(
    pool_shares_a: u64,
    pool_shares_b: u64,
    outcome: u8,
    amount: u64
) -> true_prediction_market_v3.aleo::BuyQuote {
    assert(pool_shares_a > 0u64);
    assert(pool_shares_b > 0u64);
    assert(outcome <= 1u8);
    assert(amount > 0u64);

    let k: u128 = (pool_shares_a as u128) * (pool_shares_b as u128);

    let new_b_if_0: u64 = pool_shares_b + amount;
    let new_a_if_0: u64 = (k / (new_b_if_0 as u128)) as u64;
    let shares_bought_if_0: u64 = pool_shares_a - new_a_if_0;

    let new_a_if_1: u64 = pool_shares_a + amount;
    let new_b_if_1: u64 = (k / (new_a_if_1 as u128)) as u64;
    let shares_bought_if_1: u64 = pool_shares_b - new_b_if_1;

    let quote: true_prediction_market_v3.aleo::BuyQuote = true_prediction_market_v3.aleo::BuyQuote {
        next_shares_a: outcome == 0u8 ? new_a_if_0 : new_a_if_1,
        next_shares_b: outcome == 0u8 ? new_b_if_0 : new_b_if_1,
        shares_out: outcome == 0u8 ? shares_bought_if_0 : shares_bought_if_1,
    };
    assert(quote.shares_out > 0u64);
    return quote;
}

fn compute_sell_quote(
    pool_shares_a: u64,
    pool_shares_b: u64,
    outcome: u8,
    shares_to_sell: u64
) -> true_prediction_market_v3.aleo::SellQuote {
    assert(pool_shares_a > 0u64);
    assert(pool_shares_b > 0u64);
    assert(outcome <= 1u8);
    assert(shares_to_sell > 0u64);

    let k: u128 = (pool_shares_a as u128) * (pool_shares_b as u128);

    let new_a_if_0: u64 = pool_shares_a + shares_to_sell;
    let new_b_if_0: u64 = (k / (new_a_if_0 as u128)) as u64;
    let collateral_out_if_0: u64 = pool_shares_b - new_b_if_0;

    let new_b_if_1: u64 = pool_shares_b + shares_to_sell;
    let new_a_if_1: u64 = (k / (new_b_if_1 as u128)) as u64;
    let collateral_out_if_1: u64 = pool_shares_a - new_a_if_1;

    let quote: true_prediction_market_v3.aleo::SellQuote = true_prediction_market_v3.aleo::SellQuote {
        next_shares_a: outcome == 0u8 ? new_a_if_0 : new_a_if_1,
        next_shares_b: outcome == 0u8 ? new_b_if_0 : new_b_if_1,
        collateral_out: outcome == 0u8 ? collateral_out_if_0 : collateral_out_if_1,
    };
    assert(quote.collateral_out > 0u64);
    return quote;
}
