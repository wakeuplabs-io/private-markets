import { poseidon2Hash } from "@aztec/foundation/crypto";
import { Fr } from "@aztec/foundation/fields";

/**
 * Utilities for generating IDs, secrets, commitments, and nullifiers
 * Contract reference: packages/avm/vault/src/main.nr
 */

/**
 * Generate a random secret for bet commitment
 * @returns Random Fr (Field element)
 */
export function generateSecret(): Fr {
  return Fr.random();
}

/**
 * Generate a unique bet ID
 * @returns Random Fr (must be unique per bet)
 */
export function generateBetId(): Fr {
  return Fr.random();
}

/**
 * Generate an authwit nonce for transaction authorization
 * @returns Random Fr
 */
export function generateAuthwitNonce(): Fr {
  return Fr.random();
}

/**
 * Generate commitment: poseidon2_hash([market_id, secret])
 * @param marketId - Market identifier
 * @param secret - Random secret
 * @returns Commitment as Fr
 */
export async function generateCommitment(marketId: bigint | Fr, secret: bigint | Fr): Promise<Fr> {
  const marketIdFr = typeof marketId === 'bigint' ? new Fr(marketId) : marketId;
  const secretFr = typeof secret === 'bigint' ? new Fr(secret) : secret;

  return await poseidon2Hash([marketIdFr, secretFr]);
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

/**
 * @deprecated Use generateBetId or generateAuthwitNonce instead
 * @returns Random Fr
 */
export function generateHashId(): Fr {
  return Fr.random();
}

/**
 * Convert AztecAddress to Field for nullifier computation
 * @param address - Aztec address as hex string
 * @returns Field representation as Fr
 */
export function addressToField(address: string): Fr {
  // Remove '0x' prefix if present
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
  return Fr.fromString(cleanAddress);
}

/**
 * Serialize bet data for localStorage (secret is required for claiming)
 * @param betData - Bet information to store
 * @returns JSON string
 */
export interface StoredBet {
  marketId: string;
  betId: string;
  commitment: string;
  secret: string;
  amount: string;
  outcome: boolean;
  timestamp: number;

  // Optional metadata
  marketQuestion?: string;
  txHash?: string;
}

export function serializeBet(betData: StoredBet): string {
  return JSON.stringify(betData);
}

export function deserializeBet(json: string): StoredBet {
  return JSON.parse(json);
}

/**
 * Get all stored bets for a user
 * @param userAddress - User's Aztec address
 * @returns Array of stored bets
 */
export function getStoredBets(userAddress: string): StoredBet[] {
  if (typeof window === 'undefined') return [];

  const bets: StoredBet[] = [];
  const prefix = `bet_${userAddress}_`;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          bets.push(deserializeBet(value));
        } catch (e) {
          console.error(`Failed to parse bet from storage: ${key}`, e);
        }
      }
    }
  }

  return bets.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Save bet to localStorage
 * @param userAddress - User's Aztec address
 * @param betData - Bet data to store
 */
export function storeBet(userAddress: string, betData: StoredBet): void {
  if (typeof window === 'undefined') return;

  const key = `bet_${userAddress}_${betData.betId}`;
  localStorage.setItem(key, serializeBet(betData));
}

/**
 * Get a specific bet by ID
 * @param userAddress - User's Aztec address
 * @param betId - Bet ID to retrieve
 * @returns Stored bet or null
 */
export function getStoredBet(userAddress: string, betId: string): StoredBet | null {
  if (typeof window === 'undefined') return null;

  const key = `bet_${userAddress}_${betId}`;
  const value = localStorage.getItem(key);

  if (!value) return null;

  try {
    return deserializeBet(value);
  } catch (e) {
    console.error(`Failed to parse bet from storage: ${key}`, e);
    return null;
  }
}

/**
 * Check if nullifier has been used
 * @param vaultContract - Vault contract instance
 * @param nullifier - Nullifier to check
 * @returns true if used
 */
export async function isNullifierUsed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vaultContract: { methods: { is_nullifier_used: (nullifier: Fr) => { simulate: () => Promise<boolean> } } },
  nullifier: Fr
): Promise<boolean> {
  try {
    return await vaultContract.methods.is_nullifier_used(nullifier).simulate();
  } catch (error) {
    console.error('Failed to check nullifier status:', error);
    throw error;
  }
}
