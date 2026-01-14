import { normalizeHex64 } from "@/lib/utils";

/**
 * Bet Storage Service
 *
 * Manages bet data persistence in localStorage.
 * Separation of concerns: This service is responsible for storage only,
 * while VaultService handles business logic.
 *
 * Storage Format (compatible with existing format from idGenerator.ts):
 * - Key: `bet_{userAddress}_{normalizedBetId}`
 * - Value: Serialized StoredBet object
 *
 * This maintains backwards compatibility with existing bets stored via idGenerator.ts
 */

export interface StoredBet {
  marketId: string;
  betId: string;
  commitment: string;
  secret: string;
  amount: string;
  outcome: boolean; // true = yes, false = no
  timestamp: number;
}

export class BetStorageService {
  private static instance: BetStorageService;

  private constructor() {}

  static getInstance(): BetStorageService {
    if (!BetStorageService.instance) {
      BetStorageService.instance = new BetStorageService();
    }
    return BetStorageService.instance;
  }

  /**
   * Get storage key for a specific bet
   * Uses existing format for backwards compatibility with idGenerator.ts
   */
  private getStorageKey(userAddress: string, betId: string): string {
    const normalizedBetId = normalizeHex64(betId);
    return `bet_${userAddress}_${normalizedBetId}`;
  }

  /**
   * Store a bet in localStorage
   *
   * @param userAddress - User's cleaned address (without prefix)
   * @param bet - Bet data to store
   */
  storeBet(userAddress: string, bet: StoredBet): void {
    if (typeof window === 'undefined') return;

    try {
      const key = this.getStorageKey(userAddress, bet.betId);
      localStorage.setItem(key, JSON.stringify(bet));
    } catch (error) {
      console.error('[BetStorage] Failed to store bet:', error);
      throw new Error(`Failed to store bet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific bet by betId
   *
   * @param userAddress - User's cleaned address
   * @param betId - Bet ID to retrieve
   * @returns Stored bet or null if not found
   */
  getBet(userAddress: string, betId: string): StoredBet | null {
    if (typeof window === 'undefined') return null;

    try {
      const key = this.getStorageKey(userAddress, betId);
      const value = localStorage.getItem(key);

      if (!value) return null;

      return JSON.parse(value) as StoredBet;
    } catch (error) {
      console.error('[BetStorage] Failed to get bet:', error);
      return null;
    }
  }

}

/**
 * Singleton instance export
 */
export const betStorageService = BetStorageService.getInstance();

/**
 * Default export
 */
export default betStorageService;
