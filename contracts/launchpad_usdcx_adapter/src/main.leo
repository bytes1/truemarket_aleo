import test_usdcx_stablecoin.aleo;

program launchpad_usdcx_adapter.aleo {
    const LAUNCHPAD_SLOT: u8 = 0u8;
    const MARKET_ADAPTER_SLOT: u8 = 1u8;

    mapping configured_launchpad: u8 => address;
    mapping configured_market_adapter: u8 => address;

    fn constructor() {}

    fn set_launchpad(public launchpad: address) -> Final {
        return finalize_set_launchpad(launchpad);
    }

    fn finalize_set_launchpad(launchpad: address) -> Final {
        return final {
            assert(!Mapping::contains(configured_launchpad, LAUNCHPAD_SLOT));
            Mapping::set(configured_launchpad, LAUNCHPAD_SLOT, launchpad);
        };
    }

    fn set_market_adapter(public market_adapter: address) -> Final {
        return finalize_set_market_adapter(market_adapter);
    }

    fn finalize_set_market_adapter(market_adapter: address) -> Final {
        return final {
            assert(!Mapping::contains(configured_market_adapter, MARKET_ADAPTER_SLOT));
            Mapping::set(configured_market_adapter, MARKET_ADAPTER_SLOT, market_adapter);
        };
    }

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

            let launchpad: address = Mapping::get(configured_launchpad, LAUNCHPAD_SLOT);
            assert(caller == launchpad);

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

            let launchpad: address = Mapping::get(configured_launchpad, LAUNCHPAD_SLOT);
            assert(caller == launchpad);

            transfer.run();
        };
    }

    fn push_to_market_adapter(public amount: u64) -> Final {
        let market_adapter: address = Mapping::get(configured_market_adapter, MARKET_ADAPTER_SLOT);
        let transfer: Final = test_usdcx_stablecoin.aleo::transfer_public(
            market_adapter,
            amount as u128
        );
        return finalize_push_to_market_adapter(self.caller, amount, transfer);
    }

    fn finalize_push_to_market_adapter(
        caller: address,
        amount: u64,
        transfer: Final
    ) -> Final {
        return final {
            assert(amount > 0u64);

            let launchpad: address = Mapping::get(configured_launchpad, LAUNCHPAD_SLOT);
            assert(caller == launchpad);

            transfer.run();
        };
    }
}
