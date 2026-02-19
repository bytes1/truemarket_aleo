import true_market_token.aleo;

program ture_prediction_market1.aleo {
    
    // ==========================================
    // STRUCTS
    // ==========================================

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

    // This struct will now be used DIRECTLY as the mapping key
    struct ShareKey {
        market: field,
        holder: address,
        outcome: u8,
    }

    // ==========================================
    // MAPPINGS
    // ==========================================

    mapping markets: field => Market;
    mapping pools: field => Pool;
    
    // CHANGED: Maps the ShareKey struct directly to the u64 balance
    mapping user_shares: ShareKey => u64;

    // ==========================================
    // TRANSITIONS & FINALIZATIONS
    // ==========================================

    @noupgrade
    async constructor() {}

    async transition create_market(
        public market_id: field,
        public closes_at: u32,
        public initial_liquidity: u64
    ) -> Future {
        let f0: Future = true_market_token.aleo/transfer_from_public(self.caller, self.address, initial_liquidity);
        return finalize_create_market(f0, market_id, self.caller, closes_at, initial_liquidity);
    }

    async function finalize_create_market(f0: Future, market_id: field, creator: address, closes_at: u32, initial_liquidity: u64) {
        f0.await();

        assert(!Mapping::contains(markets, market_id));

        let market: Market = Market {
            creator: creator,
            closes_at: closes_at,
            is_resolved: false,
            winning_outcome: 0u8,
            liquidity: initial_liquidity,
        };
        Mapping::set(markets, market_id, market);

        let pool: Pool = Pool {
            shares_a: initial_liquidity,
            shares_b: initial_liquidity,
        };
        Mapping::set(pools, market_id, pool);
    }

    async transition buy_shares(
        public market_id: field,
        public outcome: u8,
        public amount: u64
    ) -> Future {
        let f0: Future = true_market_token.aleo/transfer_from_public(self.caller, self.address, amount);
        return finalize_buy_shares(f0, market_id, self.caller, outcome, amount);
    }

    async function finalize_buy_shares(f0: Future, market_id: field, buyer: address, outcome: u8, amount: u64) {
        f0.await();

        let market: Market = Mapping::get(markets, market_id);
        assert(market.is_resolved == false);

        let pool: Pool = Mapping::get(pools, market_id);
        let k: u128 = (pool.shares_a as u128) * (pool.shares_b as u128);

        // Calculate Scenarios
        let new_b_if_0: u64 = pool.shares_b + amount;
        let new_a_if_0: u64 = (k / (new_b_if_0 as u128)) as u64;
        let shares_bought_if_0: u64 = pool.shares_a - new_a_if_0;

        let new_a_if_1: u64 = pool.shares_a + amount;
        let new_b_if_1: u64 = (k / (new_a_if_1 as u128)) as u64;
        let shares_bought_if_1: u64 = pool.shares_b - new_b_if_1;

        let new_a: u64 = outcome == 0u8 ? new_a_if_0 : new_a_if_1;
        let new_b: u64 = outcome == 0u8 ? new_b_if_0 : new_b_if_1;
        let shares_bought: u64 = outcome == 0u8 ? shares_bought_if_0 : shares_bought_if_1;

        let updated_pool: Pool = Pool {
            shares_a: new_a,
            shares_b: new_b,
        };
        Mapping::set(pools, market_id, updated_pool);

        // CHANGED: No more manual BHP256 hashing. Just use the struct directly.
        let key: ShareKey = ShareKey {
            market: market_id,
            holder: buyer,
            outcome: outcome,
        };
        
        let current_shares: u64 = Mapping::get_or_use(user_shares, key, 0u64);
        Mapping::set(user_shares, key, current_shares + shares_bought);
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

    async transition claim_winnings(
        public market_id: field,
        public outcome: u8,
        public claim_amount: u64
    ) -> Future {
        let f0: Future = true_market_token.aleo/transfer_public(self.caller, claim_amount);
        return finalize_claim_winnings(f0, market_id, self.caller, outcome, claim_amount);
    }

    async function finalize_claim_winnings(f0: Future, market_id: field, user: address, outcome: u8, claim_amount: u64) {
        let market: Market = Mapping::get(markets, market_id);
        assert(market.is_resolved == true);
        assert(market.winning_outcome == outcome); 

        // CHANGED: No more manual BHP256 hashing.
        let key: ShareKey = ShareKey {
            market: market_id,
            holder: user,
            outcome: outcome,
        };
        
        let user_balance: u64 = Mapping::get(user_shares, key);
        assert(user_balance >= claim_amount);

        Mapping::set(user_shares, key, user_balance - claim_amount);

        f0.await();
    }
}