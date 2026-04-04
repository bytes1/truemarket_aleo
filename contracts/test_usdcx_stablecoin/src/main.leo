program test_usdcx_stablecoin.aleo {
    mapping account: address => u128;
    mapping approvals: field => u128;

    struct approval_key {
        approver: address,
        spender: address,
    }

    fn constructor() {}

    fn mint_public(public receiver: address, public amount: u128) -> Final {
        return finalize_mint_public(receiver, amount);
    }

    fn finalize_mint_public(receiver: address, amount: u128) -> Final {
        return final {
            let current_balance: u128 = Mapping::get_or_use(account, receiver, 0u128);
            Mapping::set(account, receiver, current_balance + amount);
        };
    }

    fn transfer_public(public receiver: address, public amount: u128) -> Final {
        return finalize_transfer_public(self.caller, receiver, amount);
    }

    fn finalize_transfer_public(sender: address, receiver: address, amount: u128) -> Final {
        return final {
            let sender_balance: u128 = Mapping::get_or_use(account, sender, 0u128);
            assert(sender_balance >= amount);
            Mapping::set(account, sender, sender_balance - amount);

            let receiver_balance: u128 = Mapping::get_or_use(account, receiver, 0u128);
            Mapping::set(account, receiver, receiver_balance + amount);
        };
    }

    fn approve_public(public spender: address, public amount: u128) -> Final {
        return finalize_approve_public(self.caller, spender, amount);
    }

    fn finalize_approve_public(
        approver: address,
        spender: address,
        amount: u128
    ) -> Final {
        return final {
            let key: approval_key = approval_key {
                approver: approver,
                spender: spender,
            };
            let key_hash: field = BHP256::hash_to_field(key);

            Mapping::set(approvals, key_hash, amount);
        };
    }

    fn transfer_from_public(
        public approver: address,
        public receiver: address,
        public amount: u128
    ) -> Final {
        return finalize_transfer_from_public(approver, self.caller, receiver, amount);
    }

    fn finalize_transfer_from_public(
        approver: address,
        spender: address,
        receiver: address,
        amount: u128
    ) -> Final {
        return final {
            let key: approval_key = approval_key {
                approver: approver,
                spender: spender,
            };
            let key_hash: field = BHP256::hash_to_field(key);
            let current_allowance: u128 = Mapping::get_or_use(approvals, key_hash, 0u128);

            assert(current_allowance >= amount);
            Mapping::set(approvals, key_hash, current_allowance - amount);

            let approver_balance: u128 = Mapping::get_or_use(account, approver, 0u128);
            assert(approver_balance >= amount);
            Mapping::set(account, approver, approver_balance - amount);

            let receiver_balance: u128 = Mapping::get_or_use(account, receiver, 0u128);
            Mapping::set(account, receiver, receiver_balance + amount);
        };
    }
}
