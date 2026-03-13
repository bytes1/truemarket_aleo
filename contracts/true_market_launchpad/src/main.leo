import launchpad_usdcx_adapter.aleo;

program true_market_launchpad.aleo {
    struct LaunchRound {
        creator: address,
        closes_at: u32,
        target_liquidity: u64,
        total_liquidity: u64,
        contribution_count: u32,
        is_live: bool,
    }

    record LaunchPosition {
        owner: address,
        round_id: field,
        amount: u64,
    }

    mapping rounds: field => LaunchRound;

    @noupgrade
    async constructor() {}

    async transition create_round(
        public round_id: field,
        public closes_at: u32,
        public target_liquidity: u64
    ) -> Future {
        return finalize_create_round(round_id, self.caller, closes_at, target_liquidity);
    }

    async function finalize_create_round(
        round_id: field,
        creator: address,
        closes_at: u32,
        target_liquidity: u64
    ) {
        assert(!Mapping::contains(rounds, round_id));
        assert(closes_at > block.height);
        assert(target_liquidity > 0u64);

        let round: LaunchRound = LaunchRound {
            creator: creator,
            closes_at: closes_at,
            target_liquidity: target_liquidity,
            total_liquidity: 0u64,
            contribution_count: 0u32,
            is_live: false,
        };
        Mapping::set(rounds, round_id, round);
    }

    async transition provide_liquidity_private(
        public round_id: field,
        public amount: u64,
        private owner: address
    ) -> (LaunchPosition, Future) {
        assert(amount > 0u64);

        let position: LaunchPosition = LaunchPosition {
            owner: owner,
            round_id: round_id,
            amount: amount,
        };

        let funding: Future = launchpad_usdcx_adapter.aleo/pull_from_user(self.caller, amount);
        return (
            position,
            finalize_provide_liq(
                funding,
                round_id,
                amount
            )
        );
    }

    async function finalize_provide_liq(
        funding: Future,
        round_id: field,
        amount: u64
    ) {
        let round: LaunchRound = Mapping::get(rounds, round_id);
        assert(round.is_live == false);
        assert(block.height < round.closes_at);

        funding.await();

        let updated_round: LaunchRound = LaunchRound {
            creator: round.creator,
            closes_at: round.closes_at,
            target_liquidity: round.target_liquidity,
            total_liquidity: round.total_liquidity + amount,
            contribution_count: round.contribution_count + 1u32,
            is_live: round.is_live,
        };
        Mapping::set(rounds, round_id, updated_round);
    }

    async transition withdraw_liquidity_private(
        position: LaunchPosition,
        public amount: u64
    ) -> (LaunchPosition, Future) {
        assert(position.owner == self.caller);
        assert(amount > 0u64);
        assert(position.amount >= amount);

        let remainder: LaunchPosition = LaunchPosition {
            owner: position.owner,
            round_id: position.round_id,
            amount: position.amount - amount,
        };

        let payout: Future = launchpad_usdcx_adapter.aleo/push_to_user(self.caller, amount);
        return (
            remainder,
            finalize_withdraw_liq(
                payout,
                position.round_id,
                amount
            )
        );
    }

    async function finalize_withdraw_liq(
        payout: Future,
        round_id: field,
        amount: u64
    ) {
        let round: LaunchRound = Mapping::get(rounds, round_id);
        assert(round.is_live == false);
        assert(block.height < round.closes_at);
        assert(round.total_liquidity >= amount);

        payout.await();

        let updated_round: LaunchRound = LaunchRound {
            creator: round.creator,
            closes_at: round.closes_at,
            target_liquidity: round.target_liquidity,
            total_liquidity: round.total_liquidity - amount,
            contribution_count: round.contribution_count,
            is_live: round.is_live,
        };
        Mapping::set(rounds, round_id, updated_round);
    }

    async transition activate_round(public round_id: field) -> Future {
        return finalize_activate_round(round_id);
    }

    async function finalize_activate_round(round_id: field) {
        let round: LaunchRound = Mapping::get(rounds, round_id);
        assert(round.is_live == false);
        assert(round.total_liquidity > 0u64);
        assert(
            round.total_liquidity >= round.target_liquidity ||
            block.height >= round.closes_at
        );

        let updated_round: LaunchRound = LaunchRound {
            creator: round.creator,
            closes_at: round.closes_at,
            target_liquidity: round.target_liquidity,
            total_liquidity: round.total_liquidity,
            contribution_count: round.contribution_count,
            is_live: true,
        };
        Mapping::set(rounds, round_id, updated_round);
    }
}
