import ture_prediction_market1.aleo;

program test_sample.aleo {
    // End-to-end token-backed trade tests still need a Leo runtime.
    // The workspace now includes a local USDCX ABI stub for compilation.
    const ALT_CREATOR: address = aleo1kypwp5m7qtk9mwazgcpg0tq8aal23mnrvwfvug65qgcg9xvsrqgspyjm6n;

    @test
    transition test_quote_buy_yes_market() {
        let quote: ture_prediction_market1.aleo/BuyQuote =
            ture_prediction_market1.aleo/quote_buy(100u64, 100u64, 0u8, 10u64);

        assert_eq(quote.next_shares_a, 90u64);
        assert_eq(quote.next_shares_b, 110u64);
        assert_eq(quote.shares_out, 10u64);
    }

    @test
    transition test_quote_sell_no_market() {
        let quote: ture_prediction_market1.aleo/SellQuote =
            ture_prediction_market1.aleo/quote_sell(100u64, 100u64, 1u8, 10u64);

        assert_eq(quote.next_shares_a, 90u64);
        assert_eq(quote.next_shares_b, 110u64);
        assert_eq(quote.collateral_out, 10u64);
    }

    @test
    @should_fail
    transition test_quote_buy_rejects_invalid_outcome() {
        let _: ture_prediction_market1.aleo/BuyQuote =
            ture_prediction_market1.aleo/quote_buy(100u64, 100u64, 2u8, 10u64);
    }

    @test
    script test_resolve_market_sets_winner() {
        let market_id: field = 7field;
        let seeded_market: ture_prediction_market1.aleo/Market = ture_prediction_market1.aleo/Market {
            creator: self.caller,
            closes_at: 1000000u32,
            is_resolved: false,
            winning_outcome: 2u8,
            liquidity: 100u64,
        };

        Mapping::set(ture_prediction_market1.aleo/markets, market_id, seeded_market);

        let fut: Future = ture_prediction_market1.aleo/resolve_market(market_id, 1u8);
        fut.await();

        let updated_market: ture_prediction_market1.aleo/Market =
            Mapping::get(ture_prediction_market1.aleo/markets, market_id);
        assert_eq(updated_market.is_resolved, true);
        assert_eq(updated_market.winning_outcome, 1u8);
    }

    @test
    @should_fail
    script test_resolve_market_rejects_non_creator() {
        let market_id: field = 9field;
        let seeded_market: ture_prediction_market1.aleo/Market = ture_prediction_market1.aleo/Market {
            creator: ALT_CREATOR,
            closes_at: 1000000u32,
            is_resolved: false,
            winning_outcome: 2u8,
            liquidity: 100u64,
        };

        Mapping::set(ture_prediction_market1.aleo/markets, market_id, seeded_market);

        let fut: Future = ture_prediction_market1.aleo/resolve_market(market_id, 0u8);
        fut.await();
    }

    @noupgrade
    async constructor() {}
}
