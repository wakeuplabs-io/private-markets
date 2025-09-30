use dep::aztec::macros::aztec;

#[aztec]
pub contract BetVault {
    use dep::aztec::{
        macros::{storage::storage, events::event, functions::{private, public, internal, view, initializer}},
        state_vars::{map::Map, public_mutable::PublicMutable, public_immutable::PublicImmutable},
        protocol_types::address::AztecAddress,
        // context::PrivateContext,
        event::{event_interface::{MessageDelivery, emit_event_in_private}},
        // messaging::process_l1_to_l2_message,
        // oracle::rand::rand,
    };
    use dep::token::Token;
    // use dep::wormhole::Wormhole;
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

    // #[contract_library_method]
    // fn u128_be31(x: u128) -> [u8;31] {
    //     let f: Field = x as Field;
    //     f.to_be_bytes()
    // }

    #[private]
    fn bet(
        market_id: Field,
        outcome: u8,
        amount: u128,
        commitment: Field,
        bet_id: Field,
        authwit_nonce: Field,
        from: AztecAddress,
        _msg: [[u8;31];7], // [receiver31, chainId31, marketId31, outcome31, betId31, commitment31, reserved31] - TODO: use for Wormhole
    ) {
        // Transfer tokens to admin (who has keys to manage private balances)
        // instead of to the vault contract (which has no private keys)
        let admin_address = storage.admin.read();

        let _ = Token::at(storage.token_address.read()).transfer_private_to_private(
            from,
            admin_address,
            amount,
            authwit_nonce
        ).call(&mut context);

        BetVault::at(context.this_address())._mark_bet_processed(bet_id).enqueue(&mut context);

        emit_event_in_private(
          BetPlaced {
                market_id,
                outcome,
                amount,
                bet_id,
                commitment,
              },
              &mut context,
              context.msg_sender(),
              MessageDelivery.CONSTRAINED_ONCHAIN,
          );


        // TODO: Re-enable Wormhole integration after fixing dependencies
        // let payload_amount = u128_be31(amount);
        // let wormhole_payload = [
        //     msg[0], // ARB_RECEIVER padded a 31
        //     msg[1], // ARB_CHAIN_ID (31)
        //     msg[2], // MARKET_ID (31)
        //     msg[3], // OUTCOME (31)
        //     msg[4], // BET_ID
        //     msg[5], // COMMITMENT (31)
        //     msg[6], // RESERVED (31)
        //     payload_amount, // AMOUNT (lo pone el contrato)
        // ];

        // let _ = Wormhole::at(storage.wormhole_address.read()).publish_message_in_private(
        //     1,
        //     wormhole_payload,
        //     2,
        //     2,
        //     context.msg_sender(),
        //     authwit_nonce
        // ).call(&mut context);
    }
}

