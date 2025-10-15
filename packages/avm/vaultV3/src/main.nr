use dep::aztec::macros::aztec;

pub mod types;

#[aztec]
pub contract BetVaultV3 {
    use dep::aztec::{
        macros::{storage::storage, events::event, functions::{private, public, internal, view, initializer, utility}},
        state_vars::{map::Map, public_mutable::PublicMutable, public_immutable::PublicImmutable, private_set::PrivateSet},
        protocol_types::{address::AztecAddress, abis::function_selector::FunctionSelector},
        note::{retrieved_note::RetrievedNote, note_viewer_options::NoteViewerOptions, note_getter_options::NoteGetterOptions},
        messages::logs::note,
        event::event_interface::{emit_event_in_private},
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
            1,
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

        let calculated_commitment = dep::std::hash::pedersen_hash([market_id, secret]);
        assert(commitment == calculated_commitment, "Invalid secret for commitment");

        let options: NoteGetterOptions<BetNote, 7, Field, Field> = NoteGetterOptions::new();
        let notes = storage.user_bets.at(from).get_notes(options);
        let (found, bet_amount) = find_bet_note(notes, commitment, market_id);
        assert(found, "No bet found for this commitment");

        let recipient_field = recipient.to_field();
        let nullifier = compute_nullifier(market_id, commitment, recipient_field);

        context.call_public_function(
            context.this_address(),
            comptime {
                FunctionSelector::from_signature("_mark_nullifier_used(Field)")
            },
            [nullifier],
        );

        emit_event_in_private(
            ClaimAuthorized {
                market_id,
                nullifier,
                bet_amount,
                recipient: recipient_field,
            },
            &mut context,
            from,
            1,
        );

        let chunks = create_claim_payload(
            market_id,
            nullifier,
            bet_amount,
            recipient,
            deadline,
        );

        let _ = Wormhole::at(storage.wormhole_address.read())
            .publish_message_in_private(
                1,                // consistency level
                chunks,        // payload: [Field; 5]
                0,          // nonce
                2,          // emitter_chain
                from,
                authwit_nonce
            ).call(&mut context);
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
        let market_id_bytes: [u8; 31] = market_id.to_le_bytes::<31>();
        let bet_id_bytes: [u8; 31] = bet_id.to_le_bytes::<31>();
        let amount_field: Field = amount.to_field();
        let amount_bytes: [u8; 31] = amount_field.to_le_bytes::<31>();
        let outcome_bytes: [u8; 31] = [outcome, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        let payload: [[u8; 31]; 8] = [
            market_id_bytes,
            bet_id_bytes,
            amount_bytes,
            outcome_bytes,
            [0u8; 31],
            [0u8; 31],
            [0u8; 31],
            [0u8; 31],
        ];

        payload
    }

    // Contract library methods
    #[contract_library_method]
    fn create_claim_payload(
        market_id: Field,
        nullifier: Field,
        bet_amount: u128,
        recipient: AztecAddress,
        deadline: Field,
    ) -> [[u8; 31]; 8] {
        let market_id_bytes: [u8; 31] = market_id.to_le_bytes::<31>();
        let nullifier_bytes: [u8; 31] = nullifier.to_le_bytes::<31>();
        let bet_amount_field: Field = bet_amount.to_field();
        let bet_amount_bytes: [u8; 31] = bet_amount_field.to_le_bytes::<31>();
        let recipient_bytes: [u8; 31] = recipient.to_field().to_le_bytes::<31>();
        let deadline_bytes: [u8; 31] = deadline.to_le_bytes::<31>();

        let payload: [[u8; 31]; 8] = [
            market_id_bytes,
            nullifier_bytes,
            bet_amount_bytes,
            recipient_bytes,
            deadline_bytes,
            [0u8; 31],
            [0u8; 31],
            [0u8; 31],
        ];

        payload
    }

    #[contract_library_method]
    fn find_bet_note(
        notes: BoundedVec<RetrievedNote<BetNote>, 16>,
        commitment: Field,
        market_id: Field,
    ) -> (bool, u128) {
        let mut found = false;
        let mut bet_amount = 0u128;
        for i in 0..16 {
            let note = notes.get(i);
            let matches =
                (note.note.commitment == commitment) & (note.note.market_id == market_id);
            found = found | matches;
            bet_amount = if matches { note.note.amount } else { bet_amount };
        }

        (found, bet_amount)
    }

    #[contract_library_method]
    fn compute_nullifier(market_id: Field, commitment: Field, recipient: Field) -> Field {
        let inputs: [Field; 3] = [market_id, commitment, recipient];
        poseidon2_hash(inputs)
    }

    // Utility functions
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
