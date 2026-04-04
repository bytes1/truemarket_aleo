import test_usdcx_stablecoin.aleo;

program true_private_p2p_v3.aleo {
    struct Market {
        creator: address,
        oracle: address,
        closes_at: u32,
        is_resolved: bool,
        winning_outcome: u8,
        matched_count: u32,
        volume: u64,
    }

    struct OfferSecret {
        maker: address,
        market_id: field,
        outcome: u8,
        salt: field,
    }

    struct OfferState {
        maker: address,
        taker: address,
        market_id: field,
        stake: u64,
        commitment: field,
        is_open: bool,
        is_matched: bool,
        maker_claimed: bool,
        taker_claimed: bool,
    }

    const UNRESOLVED: u8 = 2u8;
    const CANCELED: u8 = 3u8;

    mapping markets: field => Market;
    mapping offers: field => OfferState;

    fn constructor() {}

    fn create_market(
        public market_id: field,
        public oracle: address,
        public closes_at: u32
    ) -> Final {
        return finalize_create_market(market_id, self.caller, oracle, closes_at);
    }

    fn finalize_create_market(
        market_id: field,
        creator: address,
        oracle: address,
        closes_at: u32
    ) -> Final {
        return final {
            assert(!Mapping::contains(markets, market_id));
            assert(closes_at > block.height);

            let market: Market = Market {
                creator: creator,
                oracle: oracle,
                closes_at: closes_at,
                is_resolved: false,
                winning_outcome: UNRESOLVED,
                matched_count: 0u32,
                volume: 0u64,
            };
            Mapping::set(markets, market_id, market);
        };
    }

    fn create_offer_private(
        public offer_id: field,
        public market_id: field,
        public stake: u64,
        private outcome: u8,
        private salt: field
    ) -> Final {
        assert(outcome <= 1u8);
        assert(stake > 0u64);

        let secret: OfferSecret = OfferSecret {
            maker: self.caller,
            market_id: market_id,
            outcome: outcome,
            salt: salt,
        };
        let commitment: field = BHP256::hash_to_field(secret);
        let funding: Final = test_usdcx_stablecoin.aleo::transfer_from_public(
            self.caller,
            self.address,
            stake as u128
        );
        return finalize_create_offer(funding, offer_id, market_id, stake, self.caller, commitment);
    }

    fn finalize_create_offer(
        funding: Final,
        offer_id: field,
        market_id: field,
        stake: u64,
        maker: address,
        commitment: field
    ) -> Final {
        return final {
            assert(!Mapping::contains(offers, offer_id));
            let market: Market = Mapping::get(markets, market_id);
            assert(market.is_resolved == false);
            assert(block.height < market.closes_at);

            funding.run();

            let offer: OfferState = OfferState {
                maker: maker,
                taker: maker,
                market_id: market_id,
                stake: stake,
                commitment: commitment,
                is_open: true,
                is_matched: false,
                maker_claimed: false,
                taker_claimed: false,
            };
            Mapping::set(offers, offer_id, offer);
        };
    }

    fn cancel_offer_private(
        public offer_id: field,
        public market_id: field,
        public stake: u64,
        private outcome: u8,
        private salt: field
    ) -> Final {
        let secret: OfferSecret = OfferSecret {
            maker: self.caller,
            market_id: market_id,
            outcome: outcome,
            salt: salt,
        };
        let commitment: field = BHP256::hash_to_field(secret);
        let payout: Final = test_usdcx_stablecoin.aleo::transfer_public(
            self.caller,
            stake as u128
        );
        return finalize_cancel_offer(payout, offer_id, market_id, stake, self.caller, commitment);
    }

    fn finalize_cancel_offer(
        payout: Final,
        offer_id: field,
        market_id: field,
        stake: u64,
        maker: address,
        commitment: field
    ) -> Final {
        return final {
            let offer: OfferState = Mapping::get(offers, offer_id);
            let market: Market = Mapping::get(markets, market_id);
            assert(offer.maker == maker);
            assert(offer.is_open == true);
            assert(offer.is_matched == false);
            assert(offer.market_id == market_id);
            assert(offer.stake == stake);
            assert(offer.commitment == commitment);
            assert(market.is_resolved == false);
            assert(block.height < market.closes_at);

            let closed_offer: OfferState = OfferState {
                maker: offer.maker,
                taker: offer.taker,
                market_id: offer.market_id,
                stake: offer.stake,
                commitment: offer.commitment,
                is_open: false,
                is_matched: false,
                maker_claimed: offer.maker_claimed,
                taker_claimed: offer.taker_claimed,
            };
            Mapping::set(offers, offer_id, closed_offer);

            payout.run();
        };
    }

    fn accept_offer_private(
        public offer_id: field,
        public market_id: field,
        public stake: u64,
        private maker: address,
        private outcome: u8,
        private salt: field
    ) -> Final {
        assert(self.caller != maker);
        assert(outcome <= 1u8);
        assert(stake > 0u64);

        let secret: OfferSecret = OfferSecret {
            maker: maker,
            market_id: market_id,
            outcome: outcome,
            salt: salt,
        };
        let commitment: field = BHP256::hash_to_field(secret);
        let funding: Final = test_usdcx_stablecoin.aleo::transfer_from_public(
            self.caller,
            self.address,
            stake as u128
        );
        return finalize_accept_offer(funding, offer_id, market_id, stake, maker, self.caller, commitment);
    }

    fn finalize_accept_offer(
        funding: Final,
        offer_id: field,
        market_id: field,
        stake: u64,
        maker: address,
        taker: address,
        commitment: field
    ) -> Final {
        return final {
            let offer: OfferState = Mapping::get(offers, offer_id);
            let market: Market = Mapping::get(markets, market_id);

            assert(offer.maker == maker);
            assert(offer.is_open == true);
            assert(offer.is_matched == false);
            assert(offer.market_id == market_id);
            assert(offer.stake == stake);
            assert(offer.commitment == commitment);
            assert(market.is_resolved == false);
            assert(block.height < market.closes_at);

            funding.run();

            let matched_offer: OfferState = OfferState {
                maker: offer.maker,
                taker: taker,
                market_id: offer.market_id,
                stake: offer.stake,
                commitment: offer.commitment,
                is_open: false,
                is_matched: true,
                maker_claimed: false,
                taker_claimed: false,
            };
            Mapping::set(offers, offer_id, matched_offer);

            let updated_market: Market = Market {
                creator: market.creator,
                oracle: market.oracle,
                closes_at: market.closes_at,
                is_resolved: market.is_resolved,
                winning_outcome: market.winning_outcome,
                matched_count: market.matched_count + 1u32,
                volume: market.volume + stake + stake,
            };
            Mapping::set(markets, market_id, updated_market);
        };
    }

    fn resolve_market(
        public market_id: field,
        public winning_outcome: u8
    ) -> Final {
        return finalize_resolve_market(market_id, self.caller, winning_outcome);
    }

    fn finalize_resolve_market(
        market_id: field,
        caller: address,
        winning_outcome: u8
    ) -> Final {
        return final {
            let market: Market = Mapping::get(markets, market_id);
            assert(market.oracle == caller);
            assert(market.is_resolved == false);
            assert(winning_outcome <= 1u8);
            assert(block.height >= market.closes_at);

            let updated_market: Market = Market {
                creator: market.creator,
                oracle: market.oracle,
                closes_at: market.closes_at,
                is_resolved: true,
                winning_outcome: winning_outcome,
                matched_count: market.matched_count,
                volume: market.volume,
            };
            Mapping::set(markets, market_id, updated_market);
        };
    }

    fn cancel_market(public market_id: field) -> Final {
        return finalize_cancel_market(market_id, self.caller);
    }

    fn finalize_cancel_market(
        market_id: field,
        caller: address
    ) -> Final {
        return final {
            let market: Market = Mapping::get(markets, market_id);
            assert(market.creator == caller);
            assert(market.is_resolved == false);

            let updated_market: Market = Market {
                creator: market.creator,
                oracle: market.oracle,
                closes_at: market.closes_at,
                is_resolved: true,
                winning_outcome: CANCELED,
                matched_count: market.matched_count,
                volume: market.volume,
            };
            Mapping::set(markets, market_id, updated_market);
        };
    }

    fn claim_maker_private(
        public offer_id: field,
        public market_id: field,
        public stake: u64,
        private outcome: u8,
        private salt: field
    ) -> Final {
        assert(outcome <= 1u8);

        let secret: OfferSecret = OfferSecret {
            maker: self.caller,
            market_id: market_id,
            outcome: outcome,
            salt: salt,
        };
        let commitment: field = BHP256::hash_to_field(secret);
        let payout: Final = test_usdcx_stablecoin.aleo::transfer_public(
            self.caller,
            (stake + stake) as u128
        );
        return finalize_claim_maker(payout, offer_id, market_id, stake, self.caller, commitment, outcome);
    }

    fn finalize_claim_maker(
        payout: Final,
        offer_id: field,
        market_id: field,
        stake: u64,
        maker: address,
        commitment: field,
        outcome: u8
    ) -> Final {
        return final {
            let offer: OfferState = Mapping::get(offers, offer_id);
            let market: Market = Mapping::get(markets, market_id);

            assert(offer.maker == maker);
            assert(offer.is_matched == true);
            assert(offer.market_id == market_id);
            assert(offer.stake == stake);
            assert(offer.commitment == commitment);
            assert(offer.maker_claimed == false);
            assert(market.is_resolved == true);
            assert(market.winning_outcome == outcome);

            payout.run();

            let updated_offer: OfferState = OfferState {
                maker: offer.maker,
                taker: offer.taker,
                market_id: offer.market_id,
                stake: offer.stake,
                commitment: offer.commitment,
                is_open: offer.is_open,
                is_matched: offer.is_matched,
                maker_claimed: true,
                taker_claimed: offer.taker_claimed,
            };
            Mapping::set(offers, offer_id, updated_offer);
        };
    }

    fn claim_taker_private(
        public offer_id: field,
        public market_id: field,
        public stake: u64,
        private maker: address,
        private outcome: u8,
        private salt: field
    ) -> Final {
        assert(outcome <= 1u8);

        let secret: OfferSecret = OfferSecret {
            maker: maker,
            market_id: market_id,
            outcome: outcome,
            salt: salt,
        };
        let commitment: field = BHP256::hash_to_field(secret);
        let payout: Final = test_usdcx_stablecoin.aleo::transfer_public(
            self.caller,
            (stake + stake) as u128
        );
        return finalize_claim_taker(payout, offer_id, market_id, stake, maker, self.caller, commitment, outcome);
    }

    fn finalize_claim_taker(
        payout: Final,
        offer_id: field,
        market_id: field,
        stake: u64,
        maker: address,
        taker: address,
        commitment: field,
        maker_outcome: u8
    ) -> Final {
        return final {
            let offer: OfferState = Mapping::get(offers, offer_id);
            let market: Market = Mapping::get(markets, market_id);

            assert(offer.maker == maker);
            assert(offer.taker == taker);
            assert(offer.is_matched == true);
            assert(offer.market_id == market_id);
            assert(offer.stake == stake);
            assert(offer.commitment == commitment);
            assert(offer.taker_claimed == false);
            assert(market.is_resolved == true);
            assert(market.winning_outcome <= 1u8);
            assert(market.winning_outcome != maker_outcome);

            payout.run();

            let updated_offer: OfferState = OfferState {
                maker: offer.maker,
                taker: offer.taker,
                market_id: offer.market_id,
                stake: offer.stake,
                commitment: offer.commitment,
                is_open: offer.is_open,
                is_matched: offer.is_matched,
                maker_claimed: offer.maker_claimed,
                taker_claimed: true,
            };
            Mapping::set(offers, offer_id, updated_offer);
        };
    }

    fn refund_maker_private(
        public offer_id: field,
        public market_id: field,
        public stake: u64,
        private outcome: u8,
        private salt: field
    ) -> Final {
        let secret: OfferSecret = OfferSecret {
            maker: self.caller,
            market_id: market_id,
            outcome: outcome,
            salt: salt,
        };
        let commitment: field = BHP256::hash_to_field(secret);
        let payout: Final = test_usdcx_stablecoin.aleo::transfer_public(
            self.caller,
            stake as u128
        );
        return finalize_refund_maker(payout, offer_id, market_id, stake, self.caller, commitment);
    }

    fn finalize_refund_maker(
        payout: Final,
        offer_id: field,
        market_id: field,
        stake: u64,
        maker: address,
        commitment: field
    ) -> Final {
        return final {
            let offer: OfferState = Mapping::get(offers, offer_id);
            let market: Market = Mapping::get(markets, market_id);

            assert(offer.maker == maker);
            assert(offer.market_id == market_id);
            assert(offer.stake == stake);
            assert(offer.commitment == commitment);
            assert(offer.maker_claimed == false);
            assert(market.is_resolved == true);
            assert(market.winning_outcome == CANCELED);

            payout.run();

            let updated_offer: OfferState = OfferState {
                maker: offer.maker,
                taker: offer.taker,
                market_id: offer.market_id,
                stake: offer.stake,
                commitment: offer.commitment,
                is_open: offer.is_open,
                is_matched: offer.is_matched,
                maker_claimed: true,
                taker_claimed: offer.taker_claimed,
            };
            Mapping::set(offers, offer_id, updated_offer);
        };
    }

    fn refund_taker_private(
        public offer_id: field,
        public market_id: field,
        public stake: u64,
        private maker: address,
        private outcome: u8,
        private salt: field
    ) -> Final {
        let secret: OfferSecret = OfferSecret {
            maker: maker,
            market_id: market_id,
            outcome: outcome,
            salt: salt,
        };
        let commitment: field = BHP256::hash_to_field(secret);
        let payout: Final = test_usdcx_stablecoin.aleo::transfer_public(
            self.caller,
            stake as u128
        );
        return finalize_refund_taker(payout, offer_id, market_id, stake, maker, self.caller, commitment);
    }

    fn finalize_refund_taker(
        payout: Final,
        offer_id: field,
        market_id: field,
        stake: u64,
        maker: address,
        taker: address,
        commitment: field
    ) -> Final {
        return final {
            let offer: OfferState = Mapping::get(offers, offer_id);
            let market: Market = Mapping::get(markets, market_id);

            assert(offer.maker == maker);
            assert(offer.taker == taker);
            assert(offer.is_matched == true);
            assert(offer.market_id == market_id);
            assert(offer.stake == stake);
            assert(offer.commitment == commitment);
            assert(offer.taker_claimed == false);
            assert(market.is_resolved == true);
            assert(market.winning_outcome == CANCELED);

            payout.run();

            let updated_offer: OfferState = OfferState {
                maker: offer.maker,
                taker: offer.taker,
                market_id: offer.market_id,
                stake: offer.stake,
                commitment: offer.commitment,
                is_open: offer.is_open,
                is_matched: offer.is_matched,
                maker_claimed: offer.maker_claimed,
                taker_claimed: true,
            };
            Mapping::set(offers, offer_id, updated_offer);
        };
    }
}
