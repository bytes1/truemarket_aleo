import p2p_usdcx_adapter.aleo;

program true_private_p2p.aleo {
    struct Market {
        creator: address,
        closes_at: u32,
        is_resolved: bool,
        winning_outcome: u8,
        matched_count: u32,
        volume: u64,
    }

    struct OfferSecret {
        market_id: field,
        outcome: u8,
        salt: field,
    }

    struct OfferCommitment {
        maker: address,
        market_id: field,
        stake: u64,
        commitment: field,
        is_open: bool,
    }

    record MatchedBet {
        owner: address,
        market_id: field,
        outcome: u8,
        stake: u64,
        counterparty: address,
    }

    const UNRESOLVED: u8 = 2u8;
    const CANCELED: u8 = 3u8;

    mapping markets: field => Market;
    mapping offers: field => OfferCommitment;

    @noupgrade
    async constructor() {}

    async transition create_market(
        public market_id: field,
        public closes_at: u32
    ) -> Future {
        return finalize_create_market(market_id, self.caller, closes_at);
    }

    async function finalize_create_market(
        market_id: field,
        creator: address,
        closes_at: u32
    ) {
        assert(!Mapping::contains(markets, market_id));
        assert(closes_at > block.height);

        let market: Market = Market {
            creator: creator,
            closes_at: closes_at,
            is_resolved: false,
            winning_outcome: UNRESOLVED,
            matched_count: 0u32,
            volume: 0u64,
        };
        Mapping::set(markets, market_id, market);
    }

    async transition create_offer_private(
        public offer_id: field,
        public market_id: field,
        public stake: u64,
        private outcome: u8,
        private salt: field
    ) -> Future {
        assert(outcome <= 1u8);
        assert(stake > 0u64);

        let secret: OfferSecret = OfferSecret {
            market_id: market_id,
            outcome: outcome,
            salt: salt,
        };
        let commitment: field = BHP256::hash_to_field(secret);
        let funding: Future = p2p_usdcx_adapter.aleo/pull_from_user(self.caller, stake);
        return finalize_create_offer(funding, offer_id, market_id, self.caller, stake, commitment);
    }

    async function finalize_create_offer(
        funding: Future,
        offer_id: field,
        market_id: field,
        maker: address,
        stake: u64,
        commitment: field
    ) {
        assert(!Mapping::contains(offers, offer_id));
        let market: Market = Mapping::get(markets, market_id);
        assert(market.is_resolved == false);
        assert(block.height < market.closes_at);

        funding.await();

        let offer: OfferCommitment = OfferCommitment {
            maker: maker,
            market_id: market_id,
            stake: stake,
            commitment: commitment,
            is_open: true,
        };
        Mapping::set(offers, offer_id, offer);
    }

    async transition cancel_offer_public(
        public offer_id: field,
        public stake: u64
    ) -> Future {
        let payout: Future = p2p_usdcx_adapter.aleo/push_to_user(self.caller, stake);
        return finalize_cancel_offer(payout, offer_id, self.caller, stake);
    }

    async function finalize_cancel_offer(
        payout: Future,
        offer_id: field,
        caller: address,
        stake: u64
    ) {
        let offer: OfferCommitment = Mapping::get(offers, offer_id);
        let market: Market = Mapping::get(markets, offer.market_id);
        assert(offer.maker == caller);
        assert(offer.is_open == true);
        assert(offer.stake == stake);
        assert(market.is_resolved == false);
        assert(block.height < market.closes_at);

        let closed_offer: OfferCommitment = OfferCommitment {
            maker: offer.maker,
            market_id: offer.market_id,
            stake: offer.stake,
            commitment: offer.commitment,
            is_open: false,
        };
        Mapping::set(offers, offer_id, closed_offer);

        payout.await();
    }

    async transition accept_offer_private(
        public offer_id: field,
        public maker: address,
        public market_id: field,
        public stake: u64,
        private outcome: u8,
        private salt: field,
        private taker: address
    ) -> (MatchedBet, MatchedBet, Future) {
        assert(taker != maker);
        assert(outcome <= 1u8);
        assert(stake > 0u64);

        let maker_bet: MatchedBet = MatchedBet {
            owner: maker,
            market_id: market_id,
            outcome: outcome,
            stake: stake,
            counterparty: taker,
        };

        let taker_outcome: u8 = outcome == 0u8 ? 1u8 : 0u8;
        let taker_bet: MatchedBet = MatchedBet {
            owner: taker,
            market_id: market_id,
            outcome: taker_outcome,
            stake: stake,
            counterparty: maker,
        };

        let funding: Future = p2p_usdcx_adapter.aleo/pull_from_user(self.caller, stake);
        return (
            maker_bet,
            taker_bet,
            finalize_accept_offer(funding, offer_id, maker, market_id, stake, outcome, salt)
        );
    }

    async function finalize_accept_offer(
        funding: Future,
        offer_id: field,
        maker: address,
        market_id: field,
        stake: u64,
        outcome: u8,
        salt: field
    ) {
        let offer: OfferCommitment = Mapping::get(offers, offer_id);
        let market: Market = Mapping::get(markets, market_id);
        let secret: OfferSecret = OfferSecret {
            market_id: market_id,
            outcome: outcome,
            salt: salt,
        };
        let commitment: field = BHP256::hash_to_field(secret);

        assert(offer.is_open == true);
        assert(offer.maker == maker);
        assert(offer.market_id == market_id);
        assert(offer.stake == stake);
        assert(offer.commitment == commitment);
        assert(market.is_resolved == false);
        assert(block.height < market.closes_at);

        funding.await();

        let closed_offer: OfferCommitment = OfferCommitment {
            maker: offer.maker,
            market_id: offer.market_id,
            stake: offer.stake,
            commitment: offer.commitment,
            is_open: false,
        };
        Mapping::set(offers, offer_id, closed_offer);

        let updated_market: Market = Market {
            creator: market.creator,
            closes_at: market.closes_at,
            is_resolved: market.is_resolved,
            winning_outcome: market.winning_outcome,
            matched_count: market.matched_count + 1u32,
            volume: market.volume + stake + stake,
        };
        Mapping::set(markets, market_id, updated_market);
    }

    async transition resolve_market(
        public market_id: field,
        public winning_outcome: u8
    ) -> Future {
        return finalize_resolve_market(market_id, self.caller, winning_outcome);
    }

    async function finalize_resolve_market(
        market_id: field,
        caller: address,
        winning_outcome: u8
    ) {
        assert(!Mapping::contains(offers, offer_id));
        let market: Market = Mapping::get(markets, market_id);
        assert(market.creator == caller);
        assert(market.is_resolved == false);
        assert(winning_outcome <= 1u8);
        assert(block.height >= market.closes_at);

        let updated_market: Market = Market {
            creator: market.creator,
            closes_at: market.closes_at,
            is_resolved: true,
            winning_outcome: winning_outcome,
            matched_count: market.matched_count,
            volume: market.volume,
        };
        Mapping::set(markets, market_id, updated_market);
    }

    async transition cancel_market(public market_id: field) -> Future {
        return finalize_cancel_market(market_id, self.caller);
    }

    async function finalize_cancel_market(
        market_id: field,
        caller: address
    ) {
        assert(!Mapping::contains(offers, offer_id));
        let market: Market = Mapping::get(markets, market_id);
        assert(market.creator == caller);
        assert(market.is_resolved == false);
        assert(block.height >= market.closes_at);

        let updated_market: Market = Market {
            creator: market.creator,
            closes_at: market.closes_at,
            is_resolved: true,
            winning_outcome: CANCELED,
            matched_count: market.matched_count,
            volume: market.volume,
        };
        Mapping::set(markets, market_id, updated_market);
    }

    async transition claim_private(bet: MatchedBet) -> Future {
        assert(bet.owner == self.caller);

        let payout: Future = p2p_usdcx_adapter.aleo/push_to_user(self.caller, bet.stake + bet.stake);
        return finalize_claim(payout, bet.market_id, bet.outcome);
    }

    async function finalize_claim(
        payout: Future,
        market_id: field,
        outcome: u8
    ) {
        assert(!Mapping::contains(offers, offer_id));
        let market: Market = Mapping::get(markets, market_id);
        assert(market.is_resolved == true);
        assert(market.winning_outcome == outcome);

        payout.await();
    }

    async transition refund_private(bet: MatchedBet) -> Future {
        assert(bet.owner == self.caller);

        let payout: Future = p2p_usdcx_adapter.aleo/push_to_user(self.caller, bet.stake);
        return finalize_refund(payout, bet.market_id);
    }

    async function finalize_refund(
        payout: Future,
        market_id: field
    ) {
        assert(!Mapping::contains(offers, offer_id));
        let market: Market = Mapping::get(markets, market_id);
        assert(market.is_resolved == true);
        assert(market.winning_outcome == CANCELED);

        payout.await();
    }
}


