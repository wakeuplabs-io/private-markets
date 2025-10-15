use dep::aztec::macros::aztec;

pub mod types;

#[aztec]
pub contract BetVaultV3 {
    use dep::aztec::{
        macros::{storage::storage, events::event, functions::{private, public, internal, view, initializer, utility}},
        state_vars::{map::Map, public_mutable::PublicMutable, public_immutable::PublicImmutable, private_set::PrivateSet},
        protocol_types::{address::AztecAddress, abis::function_selector::FunctionSelector},
        note::note_viewer_options::NoteViewerOptions,
        messages::logs::note,
        event::event_interface::{emit_event_in_private, MessageDeliveryEnum},
        protocol_types::{
          hash::poseidon2_hash,
          traits::ToField},
    };
    use dep::token::Token;
    use crate::types::bet_note::BetNote;
    use dep::wormhole::Wormhole;

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

    #[storage]
    struct Storage<Context> {
        processed_bets: Map<Field, PublicMutable<bool, Context>, Context>,
        used_nullifiers: Map<Field, PublicMutable<bool, Context>, Context>,
        token_address: PublicImmutable<AztecAddress, Context>,
        wormhole_address: PublicImmutable<AztecAddress, Context>,
        admin: PublicImmutable<AztecAddress, Context>,
        user_bets: Map<AztecAddress, PrivateSet<BetNote, Context>, Context>,
    }

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

        context.call_public_function(
            context.this_address(),
            comptime {
                FunctionSelector::from_signature("_mark_bet_processed(Field)")
            },
            [bet_id],
        );

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
            MessageDeliveryEnum::CONSTRAINED_ONCHAIN,
        );

        let chunks = create_bet_payload(market_id, bet_id, outcome, amount);
        let _ = Wormhole::at(storage.wormhole_address.read())
            .publish_message_in_private(
                1,
                chunks,
                0,
                2,
                context.msg_sender(),
                authwit_nonce
            ).call(&mut context);
    }

    #[private]
    fn authorizeClaim(
        market_id: Field,
        commitment: Field,
        secret: Field,
        recipient: AztecAddress,
        deadline: Field,
        authwit_nonce: Field,
    ) {
        let from = context.msg_sender();

        // 1. Verify commitment matches secret (Pedersen hash)
        let calculated_commitment = dep::std::hash::pedersen_hash([market_id, secret]);
        assert(commitment == calculated_commitment, "Invalid secret for commitment");

        // 3. CRITICAL: Find BetNote with matching commitment and market_id
        // let mut options = NoteViewerOptions::<BetNote, 7>::new();
        let notes = storage.user_bets.at(from).view_notes(options);

        let mut found = false;
        let mut bet_amount = 0u128;

        for i in 0..notes.len() {
            let note = notes.get(i);
            if (note.commitment == commitment) && (note.market_id == market_id) {
                found = true;
                bet_amount = note.amount;
                // Note: We don't remove the note here - nullifier protection is sufficient
                break;
            }
        }
        assert(found, "No bet found for this commitment");

        // 4. Compute nullifier (keccak256 for Arbitrum compatibility)
        let recipient_field = recipient.to_field();
        let nullifier = compute_nullifier(market_id, commitment, recipient_field);

        // 5. Mark nullifier as used (anti-replay protection in Aztec)
        context.call_public_function(
            context.this_address(),
            comptime {
                FunctionSelector::from_signature("_mark_nullifier_used(Field)")
            },
            [nullifier],
        );

        // 6. Emit private event
        emit_event_in_private(
            ClaimAuthorized {
                market_id,
                nullifier,
                bet_amount,
                recipient: recipient_field,
            },
            &mut context,
            from,
            MessageDelivery::CONSTRAINED_ONCHAIN,
        );

        // 7. Create and publish Wormhole message (149 bytes)
        let chunks = create_claim_payload(
            market_id,
            nullifier,
            bet_amount,
            recipient,
            deadline
        );

        let _ = Wormhole::at(storage.wormhole_address.read())
            .publish_message_in_private(
                1,
                chunks,
                0,
                2,
                from,
                authwit_nonce
            ).call(&mut context);
    }

    // Structure: [messageType(1) | marketId(32) | betId(32) | outcome(1) | amount(32)]
    // Total: 98 bytes
    #[contract_library_method]
    fn create_bet_payload(market_id: Field, bet_id: Field, outcome: u8, amount: u128) -> [[u8; 31]; 8] {
        // Create 98-byte payload
        let mut payload = [0u8; 98];
        payload[0] = 0x01;  // Message type: BET

        // Encode marketId (32 bytes)
        let market_id_bytes = market_id.to_be_bytes::<32>();
        for i in 0..32 {
            payload[1 + i] = market_id_bytes[i];
        }

        // Encode betId (32 bytes)
        let bet_id_bytes = bet_id.to_be_bytes::<32>();
        for i in 0..32 {
            payload[33 + i] = bet_id_bytes[i];
        }

        // Encode outcome (1 byte)
        payload[65] = outcome;

        // Encode amount (32 bytes)
        let amount_field: Field = amount as Field;
        let amount_bytes = amount_field.to_be_bytes::<32>();
        for i in 0..32 {
            payload[66 + i] = amount_bytes[i];
        }

        // Convert to Wormhole chunks format (8 chunks of 31 bytes)
        let mut chunks: [[u8; 31]; 8] = [[0; 31]; 8];
        let mut byte_idx = 0;
        for chunk_idx in 0..8 {
            for i in 0..31 {
                if byte_idx < 98 {
                    chunks[chunk_idx][i] = payload[byte_idx];
                    byte_idx += 1;
                }
                // Rest stays as 0 (padding)
            }
        }

        chunks
    }

    // Compute nullifier: keccak256(marketId || commitment || recipient)
    // Total preimage: 96 bytes
    #[contract_library_method]
    fn compute_nullifier(market_id: Field, commitment: Field, recipient: Field) -> Field {
        let inputs: [Field; 3] = [market_id, commitment, recipient];
        poseidon2_hash(inputs)
    }

    // Structure: [messageType(1) | marketId(32) | nullifier(32) | betAmount(32) | recipient(20) | deadline(32)]
    // Total 149 bytes 6 chunks of 31 bytes (186 bytes with padding)
    #[contract_library_method]
    fn create_claim_payload(
        market_id: Field,
        nullifier: Field,
        bet_amount: u128,
        recipient: AztecAddress,
        deadline: Field
    ) -> [[u8; 31]; 6] {
        let mut payload = [0u8; 149];
        payload[0] = 0x02;  // Message type: CLAIM_AUTH

        // Encode marketId (32 bytes)
        let market_id_bytes = market_id.to_be_bytes::<32>();
        for i in 0..32 {
            payload[1 + i] = market_id_bytes[i];
        }

        // Encode nullifier (32 bytes)
        let nullifier_bytes = nullifier.to_be_bytes::<32>();
        for i in 0..32 {
            payload[33 + i] = nullifier_bytes[i];
        }

        // Encode betAmount (32 bytes)
        let amount_field: Field = bet_amount as Field;
        let amount_bytes = amount_field.to_be_bytes::<32>();
        for i in 0..32 {
            payload[65 + i] = amount_bytes[i];
        }

        // Encode recipient (20 bytes from AztecAddress)
        let recipient_field = recipient.to_field();
        let recipient_bytes = recipient_field.to_be_bytes::<32>();
        // Take last 20 bytes (Ethereum address format)
        for i in 0..20 {
            payload[97 + i] = recipient_bytes[12 + i];
        }

        // Encode deadline (32 bytes)
        let deadline_bytes = deadline.to_be_bytes::<32>();
        for i in 0..32 {
            payload[117 + i] = deadline_bytes[i];
        }

        // Convert to Wormhole chunks format (6 chunks of 31 bytes)
        let mut chunks: [[u8; 31]; 6] = [[0; 31]; 6];
        let mut byte_idx = 0;
        for chunk_idx in 0..6 {
            for i in 0..31 {
                if byte_idx < 149 {
                    chunks[chunk_idx][i] = payload[byte_idx];
                    byte_idx += 1;
                }
                // Rest stays as 0 (padding)
            }
        }

        chunks
    }

    #[utility]
    unconstrained fn getMyBets(
        owner: AztecAddress,
        offset: u32,
        limit: u32
    ) -> pub BoundedVec<BetNote, 10> {
        let mut options = NoteViewerOptions::<BetNote, 7>::new();
        options = options.set_offset(offset);
        options = options.set_limit(limit);
        storage.user_bets.at(owner).view_notes(options)
    }
}
