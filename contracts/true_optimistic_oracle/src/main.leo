import test_usdcx_stablecoin.aleo;

program true_optimistic_oracle_v3.aleo {
    struct Proposal {
        proposer: address,
        challenger: address,
        proposed_outcome: u8,
        is_disputed: bool,
    }

    record ResolutionRecord {
        owner: address,
        market_id: field,
        winning_outcome: u8,
    }

    const LIVENESS_PERIOD: u32 = 10u32;

    // Mapping market_id => bond_amount
    mapping market_bonds: field => u64;
    // Mapping market_id => oracle address
    mapping market_oracles: field => address;
    // Mapping market_id => Proposal
    mapping proposals: field => Proposal;
    // Mapping market_id => proposal height
    mapping proposal_heights: field => u32;

    @noupgrade
    constructor() {}

    // Initialize bond amount for a market. Anyone can call this, but typically 
    // it's called during market creation. Frontrunning just burns a random field.
    fn initialize_market(public market_id: field, public bond_amount: u64, public oracle_address: address) -> Final {
        assert(bond_amount > 0u64);
        return final {
            assert(!Mapping::contains(market_bonds, market_id));
            Mapping::set(market_bonds, market_id, bond_amount);
            Mapping::set(market_oracles, market_id, oracle_address);
        };
    }

    fn propose_outcome(
        public market_id: field,
        public proposed_outcome: u8,
        public bond_amount: u64
    ) -> Final {
        assert(proposed_outcome <= 1u8);
        let caller: address = self.caller;
        
        // Transfer bond to the oracle program
        let funding: Final = test_usdcx_stablecoin.aleo::transfer_from_public(
            caller,
            self.address,
            bond_amount as u128
        );

        return final {
            assert(Mapping::contains(market_bonds, market_id));
            let required_bond: u64 = Mapping::get(market_bonds, market_id);
            assert(bond_amount == required_bond);

            // Cannot overwrite an existing proposal unless it's somehow canceled (omitted for simplicity)
            assert(!Mapping::contains(proposals, market_id));

            funding.run();

            // Set the proposal
            let proposal: Proposal = Proposal {
                proposer: caller,
                challenger: self.address, // Dummy address for now
                proposed_outcome: proposed_outcome,
                is_disputed: false,
            };
            Mapping::set(proposals, market_id, proposal);
            Mapping::set(proposal_heights, market_id, block.height);
        };
    }

    fn dispute_outcome(
        public market_id: field,
        public bond_amount: u64
    ) -> Final {
        let caller: address = self.caller;
        
        let funding: Final = test_usdcx_stablecoin.aleo::transfer_from_public(
            caller,
            self.address,
            bond_amount as u128
        );

        return final {
            assert(Mapping::contains(market_bonds, market_id));
            let required_bond: u64 = Mapping::get(market_bonds, market_id);
            assert(bond_amount == required_bond);

            assert(Mapping::contains(proposals, market_id));
            let proposal: Proposal = Mapping::get(proposals, market_id);
            
            // Can only dispute if not already disputed
            assert(proposal.is_disputed == false);

            let height: u32 = Mapping::get(proposal_heights, market_id);
            // Can only dispute within the liveness period
            assert(block.height <= height + LIVENESS_PERIOD);

            funding.run();

            let disputed_proposal: Proposal = Proposal {
                proposer: proposal.proposer,
                challenger: caller,
                proposed_outcome: proposal.proposed_outcome,
                is_disputed: true,
            };
            Mapping::set(proposals, market_id, disputed_proposal);
        };
    }

    fn finalize_outcome(
        public market_id: field,
        public expected_outcome: u8,
        public expected_proposer: address,
        public expected_bond_amount: u64
    ) -> (ResolutionRecord, Final) {
        let caller: address = self.caller;
        
        let res_record: ResolutionRecord = ResolutionRecord {
            owner: caller,
            market_id: market_id,
            winning_outcome: expected_outcome, 
        };

        let payout: Final = test_usdcx_stablecoin.aleo::transfer_public(
            expected_proposer,
            expected_bond_amount as u128
        );

        return (res_record, final {
            // Check that inputs match the actual state in mappings
            assert(Mapping::contains(market_bonds, market_id));
            let required_bond: u64 = Mapping::get(market_bonds, market_id);
            assert(expected_bond_amount == required_bond);

            assert(Mapping::contains(proposals, market_id));
            let proposal: Proposal = Mapping::get(proposals, market_id);
            assert(proposal.proposed_outcome == expected_outcome);
            assert(proposal.proposer == expected_proposer);
            assert(proposal.is_disputed == false);

            let height: u32 = Mapping::get(proposal_heights, market_id);
            assert(block.height > height + LIVENESS_PERIOD);

            payout.run();
        });
    }

    fn resolve_dispute(
        public market_id: field,
        public winning_outcome: u8,
        public expected_proposer: address,
        public expected_challenger: address,
        public expected_proposed_outcome: u8,
        public expected_bond_amount: u64,
        public oracle_address: address
    ) -> (ResolutionRecord, Final) {
        let caller: address = self.caller;
        assert(caller == oracle_address);
        assert(winning_outcome <= 1u8);

        let res_record: ResolutionRecord = ResolutionRecord {
            owner: caller,
            market_id: market_id,
            winning_outcome: winning_outcome,
        };

        // If the proposal was right, proposer gets 2x bond. Otherwise challenger gets 2x bond.
        let winner: address = winning_outcome == expected_proposed_outcome ? expected_proposer : expected_challenger;
        let payout_amount: u128 = (expected_bond_amount + expected_bond_amount) as u128;

        let payout: Final = test_usdcx_stablecoin.aleo::transfer_public(
            winner,
            payout_amount
        );

        return (res_record, final {
            assert(Mapping::contains(market_bonds, market_id));
            let required_bond: u64 = Mapping::get(market_bonds, market_id);
            assert(expected_bond_amount == required_bond);

            assert(Mapping::contains(proposals, market_id));
            let proposal: Proposal = Mapping::get(proposals, market_id);
            assert(proposal.is_disputed == true);
            assert(proposal.proposer == expected_proposer);
            assert(proposal.challenger == expected_challenger);
            assert(proposal.proposed_outcome == expected_proposed_outcome);

            // Wait... we need to ensure the caller is ACTUALLY the designated oracle!
            assert(Mapping::contains(market_oracles, market_id));
            let designated_oracle: address = Mapping::get(market_oracles, market_id);
            assert(oracle_address == designated_oracle);

            payout.run();
        });
    }
}
