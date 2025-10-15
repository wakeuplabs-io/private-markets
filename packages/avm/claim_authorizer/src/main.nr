use dep::aztec::macros::aztec;

#[aztec]
pub contract ClaimAuthorizer {
    use dep::aztec::{
        macros::{storage::storage, events::event, functions::{private, public, internal, view, initializer}},
        state_vars::{map::Map, public_mutable::PublicMutable, public_immutable::PublicImmutable},
        protocol_types::{address::AztecAddress, abis::function_selector::FunctionSelector},
        event::event_interface::{emit_event_in_private, MessageDeliveryEnum},
        hash::poseidon2_hash,
    };
    use dep::wormhole::Wormhole;

    #[event]
    struct ClaimAuthorized {
        market_id: Field,
        nullifier: Field,
        bet_amount: u128,
        recipient: Field,
    }

    #[storage]
    struct Storage<Context> {
        used_nullifiers: Map<Field, PublicMutable<bool, Context>, Context>,
        wormhole_address: PublicImmutable<AztecAddress, Context>,
        admin: PublicImmutable<AztecAddress, Context>,
    }

    #[public]
    #[initializer]
    fn constructor(wormhole_address: AztecAddress, admin: AztecAddress) {
        assert(!wormhole_address.is_zero(), "invalid wormhole address");
        assert(!admin.is_zero(), "invalid admin address");
        storage.wormhole_address.initialize(wormhole_address);
        storage.admin.initialize(admin);
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
    fn is_nullifier_used(nullifier: Field) -> bool {
        storage.used_nullifiers.at(nullifier).read()
    }

    #[public]
    #[view]
    fn get_admin() -> AztecAddress {
        storage.admin.read()
    }

    #[private]
    fn authorizeClaim(
        market_id: Field,
        commitment: Field,
        secret: Field,
        bet_amount: u128,
        recipient: AztecAddress,
        deadline: Field,
        authwit_nonce: Field,
    ) {
        // 1. Verify commitment matches secret (Pedersen hash)
        let calculated_commitment = dep::std::hash::pedersen_hash([market_id, secret]);
        assert(commitment == calculated_commitment, "Invalid secret for commitment");

        // 2. Verify deadline hasn't expired
        assert(context.timestamp() <= deadline, "Claim deadline expired");

        // 3. Compute nullifier
        let recipient_field = recipient.to_field();
        let nullifier = compute_nullifier(market_id, commitment, recipient_field);

        // 4. Mark nullifier as used (anti-replay protection)
        context.call_public_function(
            context.this_address(),
            comptime {
                FunctionSelector::from_signature("_mark_nullifier_used(Field)")
            },
            [nullifier],
        );

        // 5. Emit private event
        emit_event_in_private(
            ClaimAuthorized {
                market_id,
                nullifier,
                bet_amount,
                recipient: recipient_field,
            },
            &mut context,
            context.msg_sender(),
            MessageDeliveryEnum.CONSTRAINED_ONCHAIN,
        );

        // 6. Create and publish Wormhole message (149 bytes)
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
                context.msg_sender(),
                authwit_nonce
            ).call(&mut context);
    }

    // Compute nullifier: keccak256(marketId || commitment || recipient)
    #[contract_library_method]
    fn compute_nullifier(market_id: Field, commitment: Field, recipient: Field) -> Field {
        let mut preimage: [u8; 96] = [0; 96];

        // Encode market_id (32 bytes)
        let market_id_bytes = market_id.to_be_bytes::<32>();
        for i in 0..32 {
            preimage[i] = market_id_bytes[i];
        }

        // Encode commitment (32 bytes)
        let commitment_bytes = commitment.to_be_bytes::<32>();
        for i in 0..32 {
            preimage[32 + i] = commitment_bytes[i];
        }

        // Encode recipient (32 bytes)
        let recipient_bytes = recipient.to_be_bytes::<32>();
        for i in 0..32 {
            preimage[64 + i] = recipient_bytes[i];
        }

        // Hash with keccak256 (Arbitrum compatibility)
        let hash = keccak256(preimage, 96);

        // Convert hash bytes to Field
        let mut result: Field = 0;
        for i in 0..32 {
            result = result * 256 + hash[i] as Field;
        }
        result
    }

    // Structure: [messageType(1) | marketId(32) | nullifier(32) | betAmount(32) | recipient(20) | deadline(32)]
    // Total: 149 bytes
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
}
