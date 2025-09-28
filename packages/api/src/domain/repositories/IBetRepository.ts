/**
 * @fileoverview Bet repository interface
 * Defines the contract for bet data persistence operations
 *
 * @module domain/repositories/IBetRepository
 */

import { BetRecord } from '../entities/BetRecord';

export interface IBetRepository {
  /**
   * Stores a new bet record
   * @param bet - The bet record to store
   * @returns Promise resolving when the bet is stored
   */
  store(bet: BetRecord): Promise<void>;

  /**
   * Finds all bets for a specific market
   * @param marketId - The market ID to search for
   * @returns Promise resolving to an array of bet records
   */
  findByMarket(marketId: number): Promise<BetRecord[]>;

  /**
   * Finds a bet by its commitment
   * @param commitment - The bet commitment to search for
   * @returns Promise resolving to the bet record if found, null otherwise
   */
  findByCommitment(commitment: string): Promise<BetRecord | null>;

  /**
   * Finds all winning bets for a market with a specific outcome
   * @param marketId - The market ID
   * @param winningOutcome - The winning outcome (true/false)
   * @returns Promise resolving to an array of winning bet records
   */
  findWinners(marketId: number, winningOutcome: boolean): Promise<BetRecord[]>;

  /**
   * Gets the total number of bets for a market
   * @param marketId - The market ID
   * @returns Promise resolving to the total count
   */
  countByMarket(marketId: number): Promise<number>;

  /**
   * Checks if a bet with the given commitment exists
   * @param commitment - The bet commitment to check
   * @returns Promise resolving to true if bet exists, false otherwise
   */
  exists(commitment: string): Promise<boolean>;
}