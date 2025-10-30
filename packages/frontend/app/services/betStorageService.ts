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
   * Get all storage keys for a user
   * Scans localStorage for keys matching the pattern
   */
  private getUserBetKeys(userAddress: string): string[] {
    if (typeof window === 'undefined') return [];

    const prefix = `bet_${userAddress}_`;
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }

    return keys;
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

  /**
   * Get all bets for a user
   *
   * @param userAddress - User's cleaned address
   * @returns Array of stored bets (empty array if none)
   */
  getAllBets(userAddress: string): StoredBet[] {
    if (typeof window === 'undefined') return [];

    try {
      const keys = this.getUserBetKeys(userAddress);
      const bets: StoredBet[] = [];

      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            bets.push(JSON.parse(value) as StoredBet);
          } catch (parseError) {
            console.error(`[BetStorage] Failed to parse bet from key: ${key}`, parseError);
          }
        }
      }

      // Sort by timestamp (newest first)
      return bets.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('[BetStorage] Failed to get bets:', error);
      return [];
    }
  }

  /**
   * Get bets for a specific market
   *
   * @param userAddress - User's cleaned address
   * @param marketId - Market ID to filter by
   * @returns Array of bets for that market
   */
  getBetsByMarket(userAddress: string, marketId: string): StoredBet[] {
    try {
      const allBets = this.getAllBets(userAddress);
      return allBets.filter(bet => bet.marketId === marketId);
    } catch (error) {
      console.error('[BetStorage] Failed to get bets by market:', error);
      return [];
    }
  }

  /**
   * Delete a specific bet
   *
   * @param userAddress - User's cleaned address
   * @param betId - Bet ID to delete
   * @returns true if bet was deleted, false if not found
   */
  deleteBet(userAddress: string, betId: string): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const key = this.getStorageKey(userAddress, betId);
      const existed = localStorage.getItem(key) !== null;

      if (existed) {
        localStorage.removeItem(key);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[BetStorage] Failed to delete bet:', error);
      return false;
    }
  }

  /**
   * Clear all bets for a user
   *
   * @param userAddress - User's cleaned address
   */
  clearBets(userAddress: string): void {
    if (typeof window === 'undefined') return;

    try {
      const keys = this.getUserBetKeys(userAddress);

      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('[BetStorage] Failed to clear bets:', error);
    }
  }

  /**
   * Check if a bet exists
   *
   * @param userAddress - User's cleaned address
   * @param betId - Bet ID to check
   * @returns true if bet exists
   */
  hasBet(userAddress: string, betId: string): boolean {
    return this.getBet(userAddress, betId) !== null;
  }

  /**
   * Get bet count for a user
   *
   * @param userAddress - User's cleaned address
   * @returns Number of stored bets
   */
  getBetCount(userAddress: string): number {
    return this.getAllBets(userAddress).length;
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
