/**
 * @fileoverview Market repository interface
 * Defines the contract for market data persistence operations
 *
 * @module domain/repositories/IMarketRepository
 */

import { Market } from '../entities/Market';

export interface IMarketRepository {
  /**
   * Finds a market by its ID
   * @param id - The market ID to search for
   * @returns Promise resolving to the market if found, null otherwise
   */
  findById(id: number): Promise<Market | null>;

  /**
   * Gets all active markets
   * @returns Promise resolving to an array of active markets
   */
  findActive(): Promise<Market[]>;

  /**
   * Gets all resolved markets
   * @returns Promise resolving to an array of resolved markets
   */
  findResolved(): Promise<Market[]>;

  /**
   * Saves a market (create or update)
   * @param market - The market to save
   * @returns Promise resolving to the saved market
   */
  save(market: Market): Promise<Market>;

  /**
   * Checks if a market exists by ID
   * @param id - The market ID to check
   * @returns Promise resolving to true if market exists, false otherwise
   */
  exists(id: number): Promise<boolean>;
}