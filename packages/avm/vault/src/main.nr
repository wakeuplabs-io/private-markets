use dep::aztec::macros::aztec;
pub mod types;

#[aztec]
pub contract BetVault {
    use dep::aztec::{
        macros::{
            storage::storage,
            events::event,
            functions::{external, initializer, internal, view}
        },
        state_vars::{
            map::Map,
            public_mutable::PublicMutable,
            public_immutable::PublicImmutable,
            private_set::PrivateSet
        },
        protocol_types::{
            address::{AztecAddress, EthAddress},
            hash::poseidon2_hash,
            traits::ToField
        },
        note::note_viewer_options::NoteViewerOptions,
        messages::message_delivery::MessageDelivery,
        event::event_emission::emit_event_in_private,
    };
    use dep::token::Token;
    use crate::types::bet_note::BetNote;
    use dep::wormhole::Wormhole;


    // Events
    #[event]
    struct BetPlaced {
        market_id: Field,
        outcome: u8,
        amount: u128,
        bet_id: Field,
        commitment: Field,
    }

    #[event]
    struct ClaimAuthorized {
        market_id: Field,
        nullifier: Field,
        amount: u128,
        recipient: Field,
    }

    // Storage
    #[storage]
    struct Storage<Context> {
        processed_bets: Map<Field, PublicMutable<bool, Context>, Context>,
        used_nullifiers: Map<Field, PublicMutable<bool, Context>, Context>,
        claimed_commitments: Map<Field, PublicMutable<bool, Context>, Context>,
        token_address: PublicImmutable<AztecAddress, Context>,
        wormhole_address: PublicImmutable<AztecAddress, Context>,
        admin: PublicImmutable<AztecAddress, Context>,
        user_bets: Map<AztecAddress, PrivateSet<BetNote, Context>, Context>,
    }

    // Constructor
    #[external("public")]
    #[initializer]
    fn constructor(token_address: AztecAddress, wormhole_address: AztecAddress, admin: AztecAddress) {
        assert(!token_address.is_zero(), "invalid token address");
        assert(!wormhole_address.is_zero(), "invalid wormhole address");
        assert(!admin.is_zero(), "invalid admin address");
        storage.token_address.initialize(token_address);
        storage.wormhole_address.initialize(wormhole_address);
        storage.admin.initialize(admin);
    }

    // View functions
    #[external("public")]
    #[view]
    fn is_processed(bet_id: Field) -> bool {
        storage.processed_bets.at(bet_id).read()
    }

    #[external("public")]
    #[view]
    fn is_nullifier_used(nullifier: Field) -> bool {
        storage.used_nullifiers.at(nullifier).read()
    }

    #[external("public")]
    #[view]
    fn get_token_address() -> AztecAddress {
        storage.token_address.read()
    }

    #[external("public")]
    #[view]
    fn get_admin() -> AztecAddress {
        storage.admin.read()
    }


    // Private functions
    #[external("private")]
    fn bet(
        market_id: Field,
        outcome: u8,
        amount: u128,
        commitment: Field,
        bet_id: Field,
        authwit_nonce: Field,
        from: AztecAddress,
    ) {
        assert(amount > 0, "Amount must be greater than 0");

        let admin_address = storage.admin.read();

        let _ = Token::at(storage.token_address.read()).transfer_private_to_private(
            from,
            admin_address,
            amount,
            authwit_nonce
        ).call(&mut context);

        let block_number = context.anchor_block_header.global_variables.block_number;

        let mut bet_note = BetNote::new(from, market_id, outcome, amount, bet_id, commitment);
        bet_note.placed_at_block = block_number;

        storage.user_bets.at(from)
          .insert(bet_note)
          .emit(from, MessageDelivery.CONSTRAINED_ONCHAIN);

        BetVault::at(context.this_address())
            ._mark_bet_processed(bet_id)
            .enqueue(&mut context);

        emit_event_in_private(
            BetPlaced { market_id, outcome, amount, bet_id, commitment },
            &mut context,
            from,
            MessageDelivery.UNCONSTRAINED_ONCHAIN,
        );

        let bet_payload = create_bet_payload(market_id, bet_id, outcome, amount);

        let _ = Wormhole::at(storage.wormhole_address.read())
            .publish_message_in_private(
                1,
                bet_payload,
                0,
                2,
                context.msg_sender().unwrap(),
                authwit_nonce
            ).call(&mut context);
    }

    #[external("private")]
    fn authorizeClaim(
        market_id: Field,
        commitment: Field,
        secret: Field,
        recipient: EthAddress,
        amount: u128,
        authwit_nonce: Field,
    ) {
        let from = context.msg_sender().unwrap();

        // Verify secret and amount match the commitment
        let calculated_commitment = poseidon2_hash([market_id, amount as Field, secret]);
        assert(commitment == calculated_commitment, "Invalid secret or amount for commitment");

        // Verify amount is valid
        assert(amount > 0, "Bet amount must be greater than 0");

        // Generate nullifier
        let recipient_field = recipient.to_field();
        let nullifier = compute_nullifier(market_id, commitment, recipient_field);

        // Mark commitment as claimed and nullifier as used
        BetVault::at(context.this_address())
            ._mark_claim_processed(commitment, nullifier)
            .enqueue(&mut context);

        emit_event_in_private(
            ClaimAuthorized { market_id, nullifier, amount, recipient: recipient_field },
            &mut context,
            from,
            MessageDelivery.UNCONSTRAINED_ONCHAIN,
        );

        // Create Wormhole payload
        let claim_payload = create_claim_payload(
            market_id,
            nullifier,
            recipient,
            amount,
        );

        let _ = Wormhole::at(storage.wormhole_address.read())
            .publish_message_in_private(
                1,                // consistency level
                claim_payload, // payload: [[u8; 31]; 8]
                0,          // message_fee
                2,          // emitter_chain
                from,
                authwit_nonce
            ).call(&mut context);
    }

    // Public functions
    #[external("public")]
    #[internal]
    fn _mark_bet_processed(bet_id: Field) {
        let already = storage.processed_bets.at(bet_id).read();
        assert(!already, "bet_id already processed");
        storage.processed_bets.at(bet_id).write(true);
    }

    #[external("public")]
    #[internal]
    fn _mark_nullifier_used(nullifier: Field) {
        let already_used = storage.used_nullifiers.at(nullifier).read();
        assert(!already_used, "nullifier already used");
        storage.used_nullifiers.at(nullifier).write(true);
    }

    #[external("public")]
    #[internal]
    fn _mark_claim_processed(commitment: Field, nullifier: Field) {
        // Check if commitment already claimed
        let already_claimed = storage.claimed_commitments.at(commitment).read();
        assert(!already_claimed, "Commitment already claimed");

        // Check if nullifier already used
        let already_used = storage.used_nullifiers.at(nullifier).read();
        assert(!already_used, "Nullifier already used");

        // Mark both as used
        storage.claimed_commitments.at(commitment).write(true);
        storage.used_nullifiers.at(nullifier).write(true);
    }

    #[external("public")]
    #[view]
    fn is_commitment_claimed(commitment: Field) -> bool {
        storage.claimed_commitments.at(commitment).read()
    }

    #[contract_library_method]
    fn create_bet_payload(
        market_id: Field,
        bet_id: Field,
        outcome: u8,
        amount: u128,
    ) -> [[u8; 31]; 8] {
        // Wormhole converts each [u8; 31] chunk to Field using from_le_bytes()
        // Then guardians serialize each Field as 32 bytes big-endian in the VAA
        //
        // Format (all IDs must be <= 248 bits / 31 bytes):
        // Chunk 0: type (byte 0) + outcome (byte 1)
        // Chunk 1: market_id (31 bytes)
        // Chunk 2: bet_id (31 bytes)
        // Chunk 3: amount (31 bytes)
        // Chunks 4-7: zeros (padding)

        let mut chunks: [[u8; 31]; 8] = [[0; 31]; 8];

        // Chunk 0: type + outcome concatenated
        chunks[0][0] = 0x01;  // BET message type
        chunks[0][1] = outcome;

        // Chunk 1: market_id (must be <= 248 bits)
        chunks[1] = market_id.to_le_bytes();

        // Chunk 2: bet_id (must be <= 248 bits)
        chunks[2] = bet_id.to_le_bytes();

        // Chunk 3: amount
        chunks[3] = (amount as Field).to_le_bytes();

        // Chunks 4-7: zeros (already initialized)

        chunks
    }

    // Contract library methods
    #[contract_library_method]
    fn create_claim_payload(
        market_id: Field,
        nullifier: Field,
        recipient: EthAddress,
        amount: u128,
    ) -> [[u8; 31]; 8] {
        // Wormhole converts each [u8; 31] chunk to Field using from_le_bytes()
        // Then guardians serialize each Field as 32 bytes big-endian in the VAA
        //
        // Format (all IDs must be <= 248 bits / 31 bytes):
        // Chunk 0: type (byte 0)
        // Chunk 1: market_id (31 bytes)
        // Chunk 2: nullifier (31 bytes)
        // Chunk 3: recipient (20 bytes address) - FIXED SIZE
        // Chunk 4: amount (31 bytes) - VARIABLE SIZE, at the end
        // Chunks 5-7: zeros (padding for amount overflow)

        let mut chunks: [[u8; 31]; 8] = [[0; 31]; 8];

        // Chunk 0: Message type CLAIM (0x02)
        chunks[0][0] = 0x02;

        // Chunk 1: market_id (must be <= 248 bits)
        chunks[1] = market_id.to_le_bytes();

        // Chunk 2: nullifier (must be <= 248 bits)
        chunks[2] = nullifier.to_le_bytes();

        // Chunk 3: recipient (20 bytes address) - fixed size, before amount
        chunks[3] = recipient.to_field().to_le_bytes();

        // Chunk 4: amount - variable size, at the end
        chunks[4] = (amount as Field).to_le_bytes();

        // Chunks 5-7: zeros (already initialized)

        chunks
    }


    #[contract_library_method]
    fn compute_nullifier(market_id: Field, commitment: Field, recipient: Field) -> Field {
        let inputs: [Field; 3] = [market_id, commitment, recipient];
        let hash = poseidon2_hash(inputs);

        // Truncate to 248 bits (31 bytes) for Wormhole compatibility
        // Same pattern as normalize_to_31_bytes
        let bytes: [u8; 32] = hash.to_be_bytes();
        let mut truncated_bytes: [u8; 31] = [0; 31];
        for i in 0..31 {
            truncated_bytes[i] = bytes[i + 1];
        }
        std::field::bytes32_to_field(
            [0, truncated_bytes[0], truncated_bytes[1], truncated_bytes[2],
             truncated_bytes[3], truncated_bytes[4], truncated_bytes[5], truncated_bytes[6],
             truncated_bytes[7], truncated_bytes[8], truncated_bytes[9], truncated_bytes[10],
             truncated_bytes[11], truncated_bytes[12], truncated_bytes[13], truncated_bytes[14],
             truncated_bytes[15], truncated_bytes[16], truncated_bytes[17], truncated_bytes[18],
             truncated_bytes[19], truncated_bytes[20], truncated_bytes[21], truncated_bytes[22],
             truncated_bytes[23], truncated_bytes[24], truncated_bytes[25], truncated_bytes[26],
             truncated_bytes[27], truncated_bytes[28], truncated_bytes[29], truncated_bytes[30]]
        )
    }

    // Utility functions
    /// Returns bet note details for claim authorization
    /// This function is unconstrained and meant to be called from TypeScript before authorizeClaim
    /// Returns (found: bool, amount: u128)
    #[external("utility")]
    unconstrained fn find_bet_for_claim(
        owner: AztecAddress,
        commitment: Field,
        market_id: Field,
    ) -> pub (bool, u128) {
        // Configure options for view_notes
        let mut options = NoteViewerOptions::<BetNote, 8>::new();
        options = options.set_limit(10);

        // view_notes returns BoundedVec<BetNote, N> (without RetrievedNote wrapper)
        let notes: BoundedVec<BetNote, 10> =
            storage.user_bets.at(owner).view_notes(options);

        let mut found = false;
        let mut bet_amount = 0u128;

        // Off-chain search (does not generate constraints)
        // Only iterate up to the actual number of notes in the BoundedVec
        let len = notes.len();
        for i in 0..10 {
            if i < len {
                let note = notes.get(i);
                let matches = (note.commitment == commitment) &
                              (note.market_id == market_id);
                found = found | matches;
                bet_amount = if matches { note.amount } else { bet_amount };
            }
        }

        (found, bet_amount)
    }

    #[external("utility")]
    unconstrained fn get_user_bets(
        owner: AztecAddress,
        offset: u32,
        limit: u32
    ) -> pub BoundedVec<BetNote, 10> {
        assert(limit <= 10, "Limit must be <= 10");
        let mut options = NoteViewerOptions::<BetNote, 8>::new();
        options = options.set_offset(offset);
        options = options.set_limit(limit);
        storage.user_bets.at(owner).view_notes(options)
    }
}
