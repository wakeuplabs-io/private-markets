use dep::aztec::macros::aztec;

pub mod types;

#[aztec]
pub contract BetVault {
    use dep::aztec::{
        macros::{storage::storage, events::event, functions::{private, public, internal, view, initializer, utility}},
        state_vars::{map::Map, public_mutable::PublicMutable, public_immutable::PublicImmutable, private_set::PrivateSet},
        protocol_types::address::AztecAddress,
        note::note_viewer_options::NoteViewerOptions,
        messages::logs::note,
        event::event_interface::{emit_event_in_private, MessageDelivery},
        protocol_types::{
          hash::poseidon2_hash,
          traits::ToField
        },
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
        bet_amount: u128,
        recipient: Field,
    }

    // Storage
    #[storage]
    struct Storage<Context> {
        processed_bets: Map<Field, PublicMutable<bool, Context>, Context>,
        used_nullifiers: Map<Field, PublicMutable<bool, Context>, Context>,
        token_address: PublicImmutable<AztecAddress, Context>,
        wormhole_address: PublicImmutable<AztecAddress, Context>,
        admin: PublicImmutable<AztecAddress, Context>,
        user_bets: Map<AztecAddress, PrivateSet<BetNote, Context>, Context>,
    }

    // Constructor
    #[public]
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
    #[public]
    #[view]
    fn is_processed(bet_id: Field) -> bool {
        storage.processed_bets.at(bet_id).read()
    }

    #[public]
    #[view]
    fn is_nullifier_used(nullifier: Field) -> bool {
        storage.used_nullifiers.at(nullifier).read()
    }

    #[public]
    #[view]
    fn get_token_address() -> AztecAddress {
        storage.token_address.read()
    }

    #[public]
    #[view]
    fn get_admin() -> AztecAddress {
        storage.admin.read()
    }


    // Private functions
    #[private]
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

        let bet_note = BetNote::new(from, market_id, outcome, amount, bet_id, commitment);

        storage.user_bets.at(from)
          .insert(bet_note)
          .emit(note::encode_and_encrypt_note(&mut context, from));

        BetVault::at(context.this_address())
            ._mark_bet_processed(bet_id)
            .enqueue(&mut context);

        emit_event_in_private(
            BetPlaced {
                market_id,
                outcome,
                amount,
                bet_id,
                commitment,
            },
            &mut context,
            from,
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );

        let chunks: [[u8; 31]; 8] = create_bet_payload(market_id, bet_id, outcome, amount);
        // let _ = Wormhole::at(storage.wormhole_address.read())
        //     .publish_message_in_private(
        //         1,
        //         chunks,
        //         0,
        //         2,
        //         context.msg_sender(),
        //         authwit_nonce
        //     ).call(&mut context);
    }

    #[private]
    fn authorizeClaim(
        market_id: Field,
        commitment: Field,
        secret: Field,
        recipient: AztecAddress,
        bet_amount: u128,
        authwit_nonce: Field,
    ) {
        let from = context.msg_sender();

        // Verify secret
        let calculated_commitment = poseidon2_hash([market_id, secret]);
        assert(commitment == calculated_commitment, "Invalid secret for commitment");

        // Verify amount is valid (basic sanity check)
        assert(bet_amount > 0, "Bet amount must be greater than 0");

        // Note: The verification that the bet note exists is done in TypeScript
        // by calling find_bet_for_claim() before invoking authorizeClaim()

        // Generate nullifier
        let recipient_field = recipient.to_field();
        let nullifier = compute_nullifier(market_id, commitment, recipient_field);

        // Mark nullifier as used
        BetVault::at(context.this_address())
            ._mark_nullifier_used(nullifier)
            .enqueue(&mut context);

        // Emit event
        emit_event_in_private(
           ClaimAuthorized {
                market_id,
                nullifier,
                bet_amount,
                recipient: recipient_field,
            },
            &mut context,
            from,
            MessageDelivery.CONSTRAINED_ONCHAIN,
        );

        // Create Wormhole payload
        let chunks = create_claim_payload(
            market_id,
            nullifier,
            bet_amount,
            recipient,
        );

        // let _ = Wormhole::at(storage.wormhole_address.read())
        //     .publish_message_in_private(
        //         1,                // consistency level
        //         chunks,        // payload: [Field; 5]
        //         0,          // nonce
        //         2,          // emitter_chain
        //         from,
        //         authwit_nonce
        //     ).call(&mut context);
    }

    // Public functions
    #[public]
    #[internal]
    fn _mark_bet_processed(bet_id: Field) {
        let already = storage.processed_bets.at(bet_id).read();
        assert(!already, "bet_id already processed");
        storage.processed_bets.at(bet_id).write(true);
    }

    #[public]
    #[internal]
    fn _mark_nullifier_used(nullifier: Field) {
        let already_used = storage.used_nullifiers.at(nullifier).read();
        assert(!already_used, "nullifier already used");
        storage.used_nullifiers.at(nullifier).write(true);
    }

    #[contract_library_method]
    fn create_bet_payload(
        market_id: Field,
        bet_id: Field,
        outcome: u8,
        amount: u128,
    ) -> [[u8; 31]; 8] {
        let mut payload = [0u8; 98];
        payload[0] = 0x01;

        let market_id_bytes = market_id.to_le_bytes::<32>();
        for i in 0..32 {
            payload[1 + i] = market_id_bytes[i];
        }

        let bet_id_bytes = bet_id.to_le_bytes::<32>();
        for i in 0..32 {
            payload[33 + i] = bet_id_bytes[i];
        }

        payload[65] = outcome;

        let amount_field = amount.to_field();
        let amount_bytes = amount_field.to_le_bytes::<32>();
        for i in 0..32 {
            payload[66 + i] = amount_bytes[i];
        }

        let mut chunks: [[u8; 31]; 8] = [[0; 31]; 8];
        let mut idx = 0;
        for c in 0..8 {
            for j in 0..31 {
                if idx < 98 {
                    chunks[c][j] = payload[idx];
                    idx += 1;
                }
            }
        }

        chunks
    }

    // Contract library methods
    #[contract_library_method]
    fn create_claim_payload(
        market_id: Field,
        nullifier: Field,
        bet_amount: u128,
        recipient: AztecAddress,
    ) -> [[u8; 31]; 8] {
        let mut payload = [0u8; 129];
        payload[0] = 0x02; // Message type: CLAIM

        let market_id_bytes = market_id.to_le_bytes::<32>();
        for i in 0..32 {
            payload[1 + i] = market_id_bytes[i];
        }

        let nullifier_bytes = nullifier.to_le_bytes::<32>();
        for i in 0..32 {
            payload[33 + i] = nullifier_bytes[i];
        }

        let bet_amount_field = bet_amount.to_field();
        let bet_amount_bytes = bet_amount_field.to_le_bytes::<32>();
        for i in 0..32 {
            payload[65 + i] = bet_amount_bytes[i];
        }

        let recipient_bytes = recipient.to_field().to_le_bytes::<32>();
        for i in 0..32 {
            payload[97 + i] = recipient_bytes[i];
        }
        let mut chunks: [[u8; 31]; 8] = [[0; 31]; 8];
        let mut idx = 0;
        for c in 0..8 {
            for j in 0..31 {
                if idx < 129 {
                    chunks[c][j] = payload[idx];
                    idx += 1;
                }
            }
        }

        chunks
    }


    #[contract_library_method]
    fn compute_nullifier(market_id: Field, commitment: Field, recipient: Field) -> Field {
        let inputs: [Field; 3] = [market_id, commitment, recipient];
        poseidon2_hash(inputs)
    }

    // Utility functions
    /// Returns bet note details for claim authorization
    /// This function is unconstrained and meant to be called from TypeScript before authorizeClaim
    /// Returns (found: bool, amount: u128)
    #[utility]
    unconstrained fn find_bet_for_claim(
        owner: AztecAddress,
        commitment: Field,
        market_id: Field,
    ) -> pub (bool, u128) {
        // Configure options for view_notes
        let mut options = NoteViewerOptions::<BetNote, 7>::new();
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

    // Returns up to 10 user bets. Limit parameter must be <= 10.
    #[utility]
    unconstrained fn get_user_bets(
        owner: AztecAddress,
        offset: u32,
        limit: u32
    ) -> pub BoundedVec<BetNote, 10> {
        assert(limit <= 10, "Limit must be <= 10");
        let mut options = NoteViewerOptions::<BetNote, 7>::new();
        options = options.set_offset(offset);
        options = options.set_limit(limit);
        storage.user_bets.at(owner).view_notes(options)
    }
}
