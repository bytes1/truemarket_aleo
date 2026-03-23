import test_usdcx_stablecoin.aleo;

program p2p_usdcx_adapter_v2.aleo {
    const P2P_SLOT: u8 = 0u8;
    const ADMIN_SLOT: u8 = 1u8;

    mapping configured_p2p: u8 => address;
    mapping adapter_admin: u8 => address;

    @noupgrade
    async constructor() {}

    async transition set_p2p(public p2p: address) -> Future {
        return finalize_set_p2p(self.caller, p2p);
    }

    async function finalize_set_p2p(caller: address, p2p: address) {
        if Mapping::contains(adapter_admin, ADMIN_SLOT) {
            let admin: address = Mapping::get(adapter_admin, ADMIN_SLOT);
            assert(caller == admin);
        } else {
            Mapping::set(adapter_admin, ADMIN_SLOT, caller);
        }

        Mapping::set(configured_p2p, P2P_SLOT, p2p);
    }

    async transition pull_from_user(public owner: address, public amount: u64) -> Future {
        let transfer: Future = test_usdcx_stablecoin.aleo/transfer_from_public(owner, self.address, amount as u128);
        return finalize_pull_from_user(self.caller, amount, transfer);
    }

    async function finalize_pull_from_user(caller: address, amount: u64, transfer: Future) {
        assert(amount > 0u64);

        let p2p: address = Mapping::get(configured_p2p, P2P_SLOT);
        assert(caller == p2p);

        transfer.await();
    }

    async transition push_to_user(public recipient: address, public amount: u64) -> Future {
        let transfer: Future = test_usdcx_stablecoin.aleo/transfer_public(recipient, amount as u128);
        return finalize_push_to_user(self.caller, amount, transfer);
    }

    async function finalize_push_to_user(caller: address, amount: u64, transfer: Future) {
        assert(amount > 0u64);

        let p2p: address = Mapping::get(configured_p2p, P2P_SLOT);
        assert(caller == p2p);

        transfer.await();
    }
}

