import test_usdcx_stablecoin.aleo;

program usdcx_token_adapter.aleo {
    const MARKET_SLOT: u8 = 0u8;

    mapping configured_market: u8 => address;

    fn constructor() {}

    fn set_market(public market: address) -> Final {
        return finalize_set_market(market);
    }

    fn finalize_set_market(market: address) -> Final {
        return final {
            assert(!Mapping::contains(configured_market, MARKET_SLOT));
            Mapping::set(configured_market, MARKET_SLOT, market);
        };
    }

    // If the upstream USDCX ABI differs from the assumed public allowance model,
    // only this adapter needs to change.
    fn pull_from_user(public owner: address, public amount: u64) -> Final {
        let transfer: Final = test_usdcx_stablecoin.aleo::transfer_from_public(
            owner,
            self.address,
            amount as u128
        );
        return finalize_pull_from_user(self.caller, amount, transfer);
    }

    fn finalize_pull_from_user(caller: address, amount: u64, transfer: Final) -> Final {
        return final {
            assert(amount > 0u64);

            let market: address = Mapping::get(configured_market, MARKET_SLOT);
            assert(caller == market);

            transfer.run();
        };
    }

    fn push_to_user(public recipient: address, public amount: u64) -> Final {
        let transfer: Final = test_usdcx_stablecoin.aleo::transfer_public(
            recipient,
            amount as u128
        );
        return finalize_push_to_user(self.caller, amount, transfer);
    }

    fn finalize_push_to_user(caller: address, amount: u64, transfer: Final) -> Final {
        return final {
            assert(amount > 0u64);

            let market: address = Mapping::get(configured_market, MARKET_SLOT);
            assert(caller == market);

            transfer.run();
        };
    }
}
