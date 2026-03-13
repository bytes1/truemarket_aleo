import test_usdcx_stablecoin.aleo;

program launchpad_usdcx_adapter.aleo {
    const LAUNCHPAD_SLOT: u8 = 0u8;

    mapping configured_launchpad: u8 => address;

    @noupgrade
    async constructor() {}

    async transition set_launchpad(public launchpad: address) -> Future {
        return finalize_set_launchpad(launchpad);
    }

    async function finalize_set_launchpad(launchpad: address) {
        assert(!Mapping::contains(configured_launchpad, LAUNCHPAD_SLOT));
        Mapping::set(configured_launchpad, LAUNCHPAD_SLOT, launchpad);
    }

    async transition pull_from_user(public owner: address, public amount: u64) -> Future {
        let transfer: Future = test_usdcx_stablecoin.aleo/transfer_from_public(owner, self.address, amount as u128);
        return finalize_pull_from_user(self.caller, amount, transfer);
    }

    async function finalize_pull_from_user(caller: address, amount: u64, transfer: Future) {
        assert(amount > 0u64);

        let launchpad: address = Mapping::get(configured_launchpad, LAUNCHPAD_SLOT);
        assert(caller == launchpad);

        transfer.await();
    }

    async transition push_to_user(public recipient: address, public amount: u64) -> Future {
        let transfer: Future = test_usdcx_stablecoin.aleo/transfer_public(recipient, amount as u128);
        return finalize_push_to_user(self.caller, amount, transfer);
    }

    async function finalize_push_to_user(caller: address, amount: u64, transfer: Future) {
        assert(amount > 0u64);

        let launchpad: address = Mapping::get(configured_launchpad, LAUNCHPAD_SLOT);
        assert(caller == launchpad);

        transfer.await();
    }
}
