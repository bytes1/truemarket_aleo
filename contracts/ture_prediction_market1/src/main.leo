import usdcx_token_adapter.aleo;

program ture_prediction_market1.aleo {
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

    mapping markets: field => Market;
    mapping pools: field => Pool;

    @noupgrade
    async constructor() {}

    async transition create_market(
        public market_id: field,
        public closes_at: u32,
        public initial_liquidity: u64
    ) -> Future {
        assert(initial_liquidity > 0u64);

        let funding: Future = usdcx_token_adapter.aleo/pull_from_user(self.caller, initial_liquidity);
        return finalize_create_market(funding, market_id, self.caller, closes_at, initial_liquidity);
    }

    async function finalize_create_market(
        funding: Future,
        market_id: field,
        creator: address,
        closes_at: u32,
        initial_liquidity: u64
    ) {
        assert(!Mapping::contains(markets, market_id));
        assert(closes_at > block.height);

        funding.await();

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
    }

    transition quote_buy(
        public pool_shares_a: u64,
        public pool_shares_b: u64,
        public outcome: u8,
        public amount: u64
    ) -> BuyQuote {
        return compute_buy_quote(pool_shares_a, pool_shares_b, outcome, amount);
    }

    transition quote_sell(
        public pool_shares_a: u64,
        public pool_shares_b: u64,
        public outcome: u8,
        public shares_to_sell: u64
    ) -> SellQuote {
        return compute_sell_quote(pool_shares_a, pool_shares_b, outcome, shares_to_sell);
    }

    // The caller supplies the current pool snapshot because private record outputs
    // are created in transition scope, while public mappings are readable in finalize.
    async transition buy_private(
        public market_id: field,
        public outcome: u8,
        public amount: u64,
        private owner: address,
        public expected_shares_a: u64,
        public expected_shares_b: u64,
        public min_shares_out: u64
    ) -> (Position, Future) {
        let quote: BuyQuote = compute_buy_quote(expected_shares_a, expected_shares_b, outcome, amount);
        assert(quote.shares_out >= min_shares_out);

        let position: Position = Position {
            owner: owner,
            market_id: market_id,
            outcome: outcome,
            shares: quote.shares_out,
        };

        let funding: Future = usdcx_token_adapter.aleo/pull_from_user(self.caller, amount);
        return (
            position,
            finalize_buy_private(
                funding,
                market_id,
                outcome,
                amount,
                expected_shares_a,
                expected_shares_b
            )
        );
    }

    async function finalize_buy_private(
        funding: Future,
        market_id: field,
        outcome: u8,
        amount: u64,
        expected_shares_a: u64,
        expected_shares_b: u64
    ) {
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

        funding.await();

        let updated_pool: Pool = Pool {
            shares_a: next_shares_a,
            shares_b: next_shares_b,
        };
        Mapping::set(pools, market_id, updated_pool);
    }

    async transition sell_private(
        position: Position,
        public expected_shares_a: u64,
        public expected_shares_b: u64,
        public shares_to_sell: u64,
        public min_collateral_out: u64
    ) -> (Position, Future) {
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

        let payout: Future = usdcx_token_adapter.aleo/push_to_user(self.caller, quote.collateral_out);
        return (
            remainder,
            finalize_sell_private(
                payout,
                position.market_id,
                position.outcome,
                shares_to_sell,
                expected_shares_a,
                expected_shares_b
            )
        );
    }

    async function finalize_sell_private(
        payout: Future,
        market_id: field,
        outcome: u8,
        shares_to_sell: u64,
        expected_shares_a: u64,
        expected_shares_b: u64
    ) {
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

        payout.await();

        let updated_pool: Pool = Pool {
            shares_a: next_shares_a,
            shares_b: next_shares_b,
        };
        Mapping::set(pools, market_id, updated_pool);
    }

    async transition resolve_market(
        public market_id: field,
        public winning_outcome: u8
    ) -> Future {
        return finalize_resolve_market(market_id, self.caller, winning_outcome);
    }

    async function finalize_resolve_market(market_id: field, caller: address, winning_outcome: u8) {
        let market: Market = Mapping::get(markets, market_id);
        assert(market.creator == caller);
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
    }

    async transition claim_private(
        position: Position,
        public shares_to_claim: u64
    ) -> (Position, Future) {
        assert(position.owner == self.caller);
        assert(shares_to_claim > 0u64);
        assert(position.shares >= shares_to_claim);

        let remainder: Position = Position {
            owner: position.owner,
            market_id: position.market_id,
            outcome: position.outcome,
            shares: position.shares - shares_to_claim,
        };

        let payout: Future = usdcx_token_adapter.aleo/push_to_user(self.caller, shares_to_claim);
        return (
            remainder,
            finalize_claim_private(
                payout,
                position.market_id,
                position.outcome,
                shares_to_claim
            )
        );
    }

    async function finalize_claim_private(
        payout: Future,
        market_id: field,
        outcome: u8,
        shares_to_claim: u64
    ) {
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

        payout.await();
    }

    function compute_buy_quote(
        pool_shares_a: u64,
        pool_shares_b: u64,
        outcome: u8,
        amount: u64
    ) -> BuyQuote {
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

        let quote: BuyQuote = BuyQuote {
            next_shares_a: outcome == 0u8 ? new_a_if_0 : new_a_if_1,
            next_shares_b: outcome == 0u8 ? new_b_if_0 : new_b_if_1,
            shares_out: outcome == 0u8 ? shares_bought_if_0 : shares_bought_if_1,
        };
        assert(quote.shares_out > 0u64);
        return quote;
    }

    function compute_sell_quote(
        pool_shares_a: u64,
        pool_shares_b: u64,
        outcome: u8,
        shares_to_sell: u64
    ) -> SellQuote {
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

        let quote: SellQuote = SellQuote {
            next_shares_a: outcome == 0u8 ? new_a_if_0 : new_a_if_1,
            next_shares_b: outcome == 0u8 ? new_b_if_0 : new_b_if_1,
            collateral_out: outcome == 0u8 ? collateral_out_if_0 : collateral_out_if_1,
        };
        assert(quote.collateral_out > 0u64);
        return quote;
    }
}
