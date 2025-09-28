/**
 * @fileoverview Checkpoint repository interface
 * Manages persistence of blockchain sync checkpoints for event recovery
 *
 * @module domain/repositories/ICheckpointRepository
 */

/**
 * Checkpoint data for tracking blockchain sync progress
 */
export interface BlockCheckpoint {
  /** The last successfully processed block number */
  lastProcessedBlock: number;
  /** Timestamp when this checkpoint was last updated */
  updatedAt: Date;
  /** Optional metadata about the checkpoint */
  metadata?: {
    /** Total events processed */
    totalEventsProcessed?: number;
    /** Last event transaction hash for verification */
    lastEventTxHash?: string;
  };
}

/**
 * Repository interface for managing blockchain sync checkpoints
 * Provides persistence for tracking processed blocks to enable recovery
 */
export interface ICheckpointRepository {
  /**
   * Gets the current checkpoint
   * @returns Promise resolving to current checkpoint or null if none exists
   */
  getCheckpoint(): Promise<BlockCheckpoint | null>;

  /**
   * Updates the checkpoint with new block information
   * @param blockNumber - The last successfully processed block number
   * @param metadata - Optional metadata to store with checkpoint
   */
  updateCheckpoint(blockNumber: number, metadata?: BlockCheckpoint['metadata']): Promise<void>;

  /**
   * Clears the checkpoint (useful for testing or reset scenarios)
   */
  clearCheckpoint(): Promise<void>;

  /**
   * Gets the last processed block number, with fallback
   * @param fallbackBlock - Block number to return if no checkpoint exists
   * @returns Promise resolving to last processed block number
   */
  getLastProcessedBlock(fallbackBlock?: number): Promise<number>;
}