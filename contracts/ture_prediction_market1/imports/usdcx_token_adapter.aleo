import test_usdcx_stablecoin.aleo;

program usdcx_token_adapter.aleo {
    const MARKET_SLOT: u8 = 0u8;

    mapping configured_market: u8 => address;

    @noupgrade
    async constructor() {}

    async transition set_market(public market: address) -> Future {
        return finalize_set_market(market);
    }

    async function finalize_set_market(market: address) {
        assert(!Mapping::contains(configured_market, MARKET_SLOT));
        Mapping::set(configured_market, MARKET_SLOT, market);
    }

    async transition pull_from_user(public owner: address, public amount: u64) -> Future {
        let transfer: Future = test_usdcx_stablecoin.aleo/transfer_from_public(owner, self.address, amount as u128);
        return finalize_pull_from_user(self.caller, amount, transfer);
    }

    async function finalize_pull_from_user(caller: address, amount: u64, transfer: Future) {
        assert(amount > 0u64);

        let market: address = Mapping::get(configured_market, MARKET_SLOT);
        assert(caller == market);

        transfer.await();
    }

    async transition push_to_user(public recipient: address, public amount: u64) -> Future {
        let transfer: Future = test_usdcx_stablecoin.aleo/transfer_public(recipient, amount as u128);
        return finalize_push_to_user(self.caller, amount, transfer);
    }

    async function finalize_push_to_user(caller: address, amount: u64, transfer: Future) {
        assert(amount > 0u64);

        let market: address = Mapping::get(configured_market, MARKET_SLOT);
        assert(caller == market);

        transfer.await();
    }
}
