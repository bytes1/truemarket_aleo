import test_usdcx_stablecoin.aleo;
import true_prediction_market_v3.aleo;

program true_market_launchpad.aleo {
    struct LaunchRound {
        creator: address,
        closes_at: u32,
        target_liquidity: u64,
        total_liquidity: u64,
        contribution_count: u32,
        is_live: bool,
        is_market_launched: bool,
        launched_market_id: field,
    }

    record LaunchPosition {
        owner: address,
        round_id: field,
        amount: u64,
    }

    const MARKET_ADAPTER_SLOT: u8 = 1u8;

    mapping rounds: field => LaunchRound;
    mapping configured_market_adapter: u8 => address;

     constructor() {}

    fn set_market_adapter(public market_adapter: address) -> Final {
        return finalize_set_market_adapter(market_adapter);
    }

    fn finalize_set_market_adapter(market_adapter: address) -> Final {
        return final {
            assert(!Mapping::contains(configured_market_adapter, MARKET_ADAPTER_SLOT));
            Mapping::set(configured_market_adapter, MARKET_ADAPTER_SLOT, market_adapter);
        };
    }

    fn create_round(
        public round_id: field,
        public closes_at: u32,
        public target_liquidity: u64
    ) -> Final {
        return finalize_create_round(round_id, self.caller, closes_at, target_liquidity);
    }

    fn finalize_create_round(
        round_id: field,
        creator: address,
        closes_at: u32,
        target_liquidity: u64
    ) -> Final {
        return final {
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
                is_market_launched: false,
                launched_market_id: 0field,
            };
            Mapping::set(rounds, round_id, round);
        };
    }

    fn provide_liquidity_private(
        public round_id: field,
        public amount: u64,
        private owner: address
    ) -> (LaunchPosition, Final) {
        assert(amount > 0u64);

        let position: LaunchPosition = LaunchPosition {
            owner: owner,
            round_id: round_id,
            amount: amount,
        };

        let funding: Final = test_usdcx_stablecoin.aleo::transfer_from_public(
            self.caller,
            self.address,
            amount as u128
        );
        return (
            position,
            finalize_provide_liq(
                funding,
                round_id,
                amount
            )
        );
    }

    fn finalize_provide_liq(
        funding: Final,
        round_id: field,
        amount: u64
    ) -> Final {
        return final {
            let round: LaunchRound = Mapping::get(rounds, round_id);
            assert(round.is_live == false);
            assert(block.height < round.closes_at);

            funding.run();

            let updated_round: LaunchRound = LaunchRound {
                creator: round.creator,
                closes_at: round.closes_at,
                target_liquidity: round.target_liquidity,
                total_liquidity: round.total_liquidity + amount,
                contribution_count: round.contribution_count + 1u32,
                is_live: round.is_live,
                is_market_launched: round.is_market_launched,
                launched_market_id: round.launched_market_id,
            };
            Mapping::set(rounds, round_id, updated_round);
        };
    }

    fn withdraw_liquidity_private(
        position: LaunchPosition,
        public amount: u64
    ) -> (LaunchPosition, Final) {
        assert(position.owner == self.caller);
        assert(amount > 0u64);
        assert(position.amount >= amount);

        let remainder: LaunchPosition = LaunchPosition {
            owner: position.owner,
            round_id: position.round_id,
            amount: position.amount - amount,
        };

        let payout: Final = test_usdcx_stablecoin.aleo::transfer_public(
            self.caller,
            amount as u128
        );
        return (
            remainder,
            finalize_withdraw_liq(
                payout,
                position.round_id,
                amount
            )
        );
    }

    fn finalize_withdraw_liq(
        payout: Final,
        round_id: field,
        amount: u64
    ) -> Final {
        return final {
            let round: LaunchRound = Mapping::get(rounds, round_id);
            assert(round.is_live == false);
            assert(block.height < round.closes_at);
            assert(round.total_liquidity >= amount);

            payout.run();

            let updated_round: LaunchRound = LaunchRound {
                creator: round.creator,
                closes_at: round.closes_at,
                target_liquidity: round.target_liquidity,
                total_liquidity: round.total_liquidity - amount,
                contribution_count: round.contribution_count,
                is_live: round.is_live,
                is_market_launched: round.is_market_launched,
                launched_market_id: round.launched_market_id,
            };
            Mapping::set(rounds, round_id, updated_round);
        };
    }

    fn activate_round(public round_id: field) -> Final {
        return finalize_activate_round(round_id);
    }

    fn finalize_activate_round(round_id: field) -> Final {
        return final {
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
                is_market_launched: round.is_market_launched,
                launched_market_id: round.launched_market_id,
            };
            Mapping::set(rounds, round_id, updated_round);
        };
    }

    fn launch_market(
        public round_id: field,
        public market_id: field,
        public market_closes_at: u32,
        public initial_liquidity: u64
    ) -> Final {
        let market_adapter: address = Mapping::get(configured_market_adapter, MARKET_ADAPTER_SLOT);
        let funding: Final =
            test_usdcx_stablecoin.aleo::transfer_public(market_adapter, initial_liquidity as u128);
        let create_market: Final =
            true_prediction_market_v3.aleo::create_market_from_launchpad(
                market_id,
                self.caller,
                market_closes_at,
                initial_liquidity
            );

        return finalize_launch_market(
            funding,
            create_market,
            round_id,
            market_id,
            self.caller,
            market_closes_at,
            initial_liquidity
        );
    }

    fn finalize_launch_market(
        funding: Final,
        create_market: Final,
        round_id: field,
        market_id: field,
        caller: address,
        market_closes_at: u32,
        initial_liquidity: u64
    ) -> Final {
        return final {
            let round: LaunchRound = Mapping::get(rounds, round_id);
            assert(round.creator == caller);
            assert(round.is_live == true);
            assert(round.is_market_launched == false);
            assert(round.total_liquidity > 0u64);
            assert(round.total_liquidity == initial_liquidity);
            assert(market_closes_at > block.height);

            funding.run();
            create_market.run();

            let updated_round: LaunchRound = LaunchRound {
                creator: round.creator,
                closes_at: round.closes_at,
                target_liquidity: round.target_liquidity,
                total_liquidity: round.total_liquidity,
                contribution_count: round.contribution_count,
                is_live: round.is_live,
                is_market_launched: true,
                launched_market_id: market_id,
            };
            Mapping::set(rounds, round_id, updated_round);
        };
    }
}
