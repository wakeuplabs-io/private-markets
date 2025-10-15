use dep::aztec::{
    macros::notes::note,
    oracle::random::random,
    protocol_types::{address::AztecAddress, traits::{Serialize, Deserialize, Packable}},
};

#[derive(Eq, Serialize, Deserialize, Packable)]
#[note]
pub struct BetNote {
    pub owner: AztecAddress,
    pub market_id: Field,
    pub outcome: u8,
    pub amount: u128,
    pub bet_id: Field,
    pub commitment: Field,
    pub randomness: Field,
}

impl BetNote {
    pub fn new(
        owner: AztecAddress,
        market_id: Field,
        outcome: u8,
        amount: u128,
        bet_id: Field,
        commitment: Field,
    ) -> Self {
        // Safety: We use randomness to preserve privacy of the note recipient by preventing brute-forcing,
        // so a malicious sender could use non-random values to make the note less private. But they already know
        // the full note pre-image anyway, and so the recipient already trusts them to not disclose this
        // information. We can therefore assume that the sender will cooperate in the random value generation.
        let randomness = unsafe { random() };
        Self { owner, market_id, outcome, amount, bet_id, commitment, randomness }
    }
}
