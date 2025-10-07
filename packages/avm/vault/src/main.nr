use dep::aztec::macros::aztec;

pub mod types;

#[aztec]
pub contract BetVault {
    use dep::aztec::{
        macros::{storage::storage, events::event, functions::{private, public, internal, view, initializer, utility}},
        state_vars::{map::Map, public_mutable::PublicMutable, public_immutable::PublicImmutable, private_set::PrivateSet},
        protocol_types::{address::AztecAddress, abis::function_selector::FunctionSelector},
        note::note_viewer_options::NoteViewerOptions,
        messages::logs::note,
        event::event_interface::{emit_event_in_private, MessageDelivery},
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

    #[storage]
    struct Storage<Context> {
        processed_bets: Map<Field, PublicMutable<bool, Context>, Context>,
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
    #[view]
    fn is_processed(bet_id: Field) -> bool {
        storage.processed_bets.at(bet_id).read()
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
            MessageDelivery.CONSTRAINED_ONCHAIN,
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

    // Structure: [messageType(1) | marketId(32) | betId(32) | outcome(1) | amount(32)]
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

