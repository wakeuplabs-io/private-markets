import { poseidon2Hash } from "@aztec/foundation/crypto";
import { Fr } from "@aztec/foundation/fields";

/**
 * Utilities for generating IDs, secrets, commitments, and nullifiers
 * Contract reference: packages/avm/vault/src/main.nr
 */

// Maximum value for 248 bits (31 bytes) - required for Wormhole payload encoding
// Wormhole uses to_le_bytes::<31>() which only supports values up to 248 bits
const MAX_248_BITS = (1n << 248n) - 1n;

/**
 * Generate a random Fr value that fits in 31 bytes (248 bits).
 * This is required because Wormhole payload encoding uses to_le_bytes::<31>()
 * which only supports values up to 248 bits.
 * @returns Random Fr masked to 248 bits
 */
function generateRandom248BitFr(): Fr {
  const random = Fr.random();
  const randomBigInt = random.toBigInt();
  // Mask to 248 bits (clear the top 8 bits)
  const masked = randomBigInt & MAX_248_BITS;
  return new Fr(masked);
}

/**
 * Generate a random secret for bet commitment
 * Uses 248-bit values for Wormhole cross-chain compatibility
 * @returns Random Fr (Field element, 248-bit)
 */
export function generateSecret(): Fr {
  return generateRandom248BitFr();
}

/**
 * Generate a unique bet ID
 * Uses 248-bit values for Wormhole cross-chain compatibility
 * @returns Random Fr (must be unique per bet, 248-bit)
 */
export function generateBetId(): Fr {
  return generateRandom248BitFr();
}

/**
 * Generate an authwit nonce for transaction authorization
 * Uses 248-bit values for consistency (though authwit doesn't go cross-chain)
 * @returns Random Fr (248-bit)
 */
export function generateAuthwitNonce(): Fr {
  return generateRandom248BitFr();
}

/**
 * Generate commitment: poseidon2_hash([market_id, amount, secret])
 * @param marketId - Market identifier
 * @param amount - Bet amount in wei (e18 format, must match the amount stored in the contract)
 * @param secret - Random secret
 * @returns Commitment as Fr
 */
export async function generateCommitment(marketId: bigint | Fr, amount: bigint | Fr, secret: bigint | Fr): Promise<Fr> {
  const marketIdFr = typeof marketId === 'bigint' ? new Fr(marketId) : marketId;
  const amountFr = typeof amount === 'bigint' ? new Fr(amount) : amount;
  const secretFr = typeof secret === 'bigint' ? new Fr(secret) : secret;

  return await poseidon2Hash([marketIdFr, amountFr, secretFr]);
}

/**
 * Compute nullifier: poseidon2_hash([market_id, commitment, recipient])
 * @param marketId - Market identifier
 * @param commitment - Bet commitment
 * @param recipient - Recipient address as Field
 * @returns Nullifier as Fr
 */
export async function computeNullifier(
  marketId: bigint | Fr,
  commitment: bigint | Fr,
  recipient: bigint | Fr
): Promise<Fr> {
  const marketIdFr = typeof marketId === 'bigint' ? new Fr(marketId) : marketId;
  const commitmentFr = typeof commitment === 'bigint' ? new Fr(commitment) : commitment;
  const recipientFr = typeof recipient === 'bigint' ? new Fr(recipient) : recipient;

  return await poseidon2Hash([marketIdFr, commitmentFr, recipientFr]);
}
