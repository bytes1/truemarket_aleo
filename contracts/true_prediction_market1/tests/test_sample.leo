import true_prediction_market_v4.aleo;

program test_sample.aleo {
    // End-to-end token-backed trade tests still need a Leo runtime.
    // The workspace now includes a local USDCX ABI stub for compilation.
    const ALT_CREATOR: address = aleo1kypwp5m7qtk9mwazgcpg0tq8aal23mnrvwfvug65qgcg9xvsrqgspyjm6n;

    @test
    fn test_quote_buy_yes_market() {
        let quote: true_prediction_market_v4.aleo::BuyQuote =
            true_prediction_market_v4.aleo::quote_buy(100u64, 100u64, 0u8, 10u64);

        assert_eq(quote.next_shares_a, 90u64);
        assert_eq(quote.next_shares_b, 110u64);
        assert_eq(quote.shares_out, 10u64);
    }

    @test
    fn test_quote_sell_no_market() {
        let quote: true_prediction_market_v4.aleo::SellQuote =
            true_prediction_market_v4.aleo::quote_sell(100u64, 100u64, 1u8, 10u64);

        assert_eq(quote.next_shares_a, 90u64);
        assert_eq(quote.next_shares_b, 110u64);
        assert_eq(quote.collateral_out, 10u64);
    }

    @test
    @should_fail
    fn test_quote_buy_rejects_invalid_outcome() {
        let _: true_prediction_market_v4.aleo::BuyQuote =
            true_prediction_market_v4.aleo::quote_buy(100u64, 100u64, 2u8, 10u64);
    }

    @test
    fn test_resolve_market_sets_winner() {
        let market_id: field = 7field;
        let seeded_market: true_prediction_market_v4.aleo::Market = true_prediction_market_v4.aleo::Market {
            creator: self.caller,
            closes_at: 1000000u32,
            is_resolved: false,
            winning_outcome: 2u8,
            liquidity: 100u64,
        };

        Mapping::set(true_prediction_market_v4.aleo::markets, market_id, seeded_market);

        let fin: Final = true_prediction_market_v4.aleo::resolve_market(market_id, 1u8);
        fin.run();

        let updated_market: true_prediction_market_v4.aleo::Market =
            Mapping::get(true_prediction_market_v4.aleo::markets, market_id);
        assert_eq(updated_market.is_resolved, true);
        assert_eq(updated_market.winning_outcome, 1u8);
    }

    @test
    @should_fail
    fn test_resolve_market_rejects_non_creator() {
        let market_id: field = 9field;
        let seeded_market: true_prediction_market_v4.aleo::Market = true_prediction_market_v4.aleo::Market {
            creator: ALT_CREATOR,
            closes_at: 1000000u32,
            is_resolved: false,
            winning_outcome: 2u8,
            liquidity: 100u64,
        };

        Mapping::set(true_prediction_market_v4.aleo::markets, market_id, seeded_market);

        let fin: Final = true_prediction_market_v4.aleo::resolve_market(market_id, 0u8);
        fin.run();
    }

    fn constructor() {}
}
