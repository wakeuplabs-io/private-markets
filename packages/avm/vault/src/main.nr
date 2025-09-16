use dep::aztec::macros::aztec;

#[aztec]
pub contract BetVault {
    use dep::aztec::{
        event::event_interface::{emit_event_in_private_log, PrivateLogContent},
        macros::{storage::storage, events::event, functions::{private, public, internal, view, initializer}},
        prelude::{AztecAddress, Map, PublicMutable, PublicImmutable},
    };
    use dep::token::Token;
    // use dep::wormhole::Wormhole;

    pub global WORMHOLE_ADDRESS: AztecAddress = AztecAddress {
        inner: 0x1111111111111111111111111111111111111111111111111111111111111111
    };

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
    }

    #[public]
    #[initializer]
    fn constructor(token_address: AztecAddress) {
        assert(!token_address.is_zero(), "invalid token address");
        storage.token_address.initialize(token_address);
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

    // #[contract_library_method]
    // fn u128_be31(x: u128) -> [u8;31] {
    //     let f: Field = x as Field;
    //     f.to_be_bytes()
    // }

    #[private]
    pub fn bet(
        market_id: Field,
        outcome: u8,
        amount: u128,
        commitment: Field,
        bet_id: Field,
        authwit_nonce: Field,
        from: AztecAddress,
        msg: [[u8;31];7], // [receiver31, chainId31, marketId31, outcome31, betId31, commitment31, reserved31]
    ) {
        let _ = Token::at(storage.token_address.read()).transfer_in_private(
            from,
            context.this_address(),
            amount,
            authwit_nonce
        ).call(&mut context);

        BetVault::at(context.this_address())._mark_bet_processed(bet_id).enqueue(&mut context);

        let ev = BetPlaced { market_id, outcome, amount, bet_id, commitment };
        emit_event_in_private_log(
            ev,
            &mut context,
            context.this_address(),
            from,
            PrivateLogContent.CONSTRAINED_ENCRYPTION
        );

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

        // let _ = Wormhole::at(WORMHOLE_ADDRESS).publish_message_in_private(
        //     1,
        //     wormhole_payload,
        //     2,
        //     2,
        //     context.msg_sender(),
        //     authwit_nonce
        // ).call(&mut context);
    }
}
