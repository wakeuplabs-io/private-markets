/**
 * @fileoverview Resolution repository interface
 * Defines the contract for market resolution data persistence operations
 *
 * @module domain/repositories/IResolutionRepository
 */

import { MarketResolution } from '../entities/MarketResolution';
import type { MerkleProof } from '../services/IMerkleService';

export interface IResolutionRepository {
  /**
   * Stores a market resolution with all its proof data
   * @param resolution - The market resolution to store
   * @returns Promise resolving when resolution is stored
   */
  store(resolution: MarketResolution): Promise<void>;

  /**
   * Finds a resolution by market ID
   * @param marketId - The market ID to search for
   * @returns Promise resolving to the resolution if found, null otherwise
   */
  findByMarketId(marketId: number): Promise<MarketResolution | null>;

  /**
   * Gets all resolved markets
   * @returns Promise resolving to an array of all resolutions
   */
  findAll(): Promise<MarketResolution[]>;

  /**
   * Checks if a market has been resolved
   * @param marketId - The market ID to check
   * @returns Promise resolving to true if resolved, false otherwise
   */
  isResolved(marketId: number): Promise<boolean>;

  /**
   * Gets a specific proof for a commitment
   * @param commitment - The commitment hash to find proof for
   * @returns Promise resolving to proof data if found, null otherwise
   */
  getProof(commitment: string): Promise<{
    marketId: number;
    proof: MerkleProof;
    resolution: MarketResolution;
  } | null>;

  /**
   * Finds all resolutions containing a specific commitment
   * @param commitment - The commitment to search for
   * @returns Promise resolving to array of resolutions containing the commitment
   */
  findByCommitment(commitment: string): Promise<MarketResolution[]>;

  /**
   * Gets resolution statistics
   * @returns Promise resolving to statistics about stored resolutions
   */
  getStats(): Promise<{
    totalResolutions: number;
    totalProofs: number;
    totalWinners: number;
    oldestResolution?: Date;
    newestResolution?: Date;
  }>;

  /**
   * Deletes a resolution by market ID
   * @param marketId - The market ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  delete(marketId: number): Promise<boolean>;

  /**
   * Updates the resolution for a market (replace existing)
   * @param resolution - The new resolution data
   * @returns Promise resolving when update is complete
   */
  update(resolution: MarketResolution): Promise<void>;

  /**
   * Checks if a specific commitment-amount pair has a proof
   * @param commitment - The commitment hash
   * @param amount - The bet amount in wei
   * @returns Promise resolving to true if proof exists
   */
  hasProof(commitment: string, amount: string): Promise<boolean>;

  /**
   * Gets all winning commitments for a market
   * @param marketId - The market ID
   * @returns Promise resolving to array of winning commitment hashes
   */
  getWinningCommitments(marketId: number): Promise<string[]>;

  /**
   * Clears all resolutions (for testing)
   * @returns Promise resolving when all data is cleared
   */
  clear(): Promise<void>;
}