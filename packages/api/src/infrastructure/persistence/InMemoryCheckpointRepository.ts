/**
 * @fileoverview In-memory implementation of Checkpoint repository
 * Provides checkpoint storage for blockchain sync progress
 *
 * @module infrastructure/persistence/InMemoryCheckpointRepository
 */

import { ICheckpointRepository, BlockCheckpoint } from '../../domain/repositories/ICheckpointRepository';
import type { Logger } from 'pino';

export class InMemoryCheckpointRepository implements ICheckpointRepository {
  private checkpoint: BlockCheckpoint | null = null;

  constructor(private logger: Logger) {}

  async getCheckpoint(): Promise<BlockCheckpoint | null> {
    this.logger.debug({
      hasCheckpoint: this.checkpoint !== null,
      lastProcessedBlock: this.checkpoint?.lastProcessedBlock,
      updatedAt: this.checkpoint?.updatedAt
    }, 'Retrieved checkpoint');

    return this.checkpoint;
  }

  async updateCheckpoint(blockNumber: number, metadata?: BlockCheckpoint['metadata']): Promise<void> {
    const previousBlock = this.checkpoint?.lastProcessedBlock;

    this.checkpoint = {
      lastProcessedBlock: blockNumber,
      updatedAt: new Date(),
      metadata
    };

    this.logger.info({
      previousBlock,
      newBlock: blockNumber,
      advancement: previousBlock ? blockNumber - previousBlock : 0,
      totalEventsProcessed: metadata?.totalEventsProcessed,
      lastEventTxHash: metadata?.lastEventTxHash
    }, 'Checkpoint updated');
  }

  async clearCheckpoint(): Promise<void> {
    const previousCheckpoint = this.checkpoint;

    this.checkpoint = null;

    this.logger.info({
      clearedBlock: previousCheckpoint?.lastProcessedBlock,
      clearedAt: previousCheckpoint?.updatedAt
    }, 'Checkpoint cleared');
  }

  async getLastProcessedBlock(fallbackBlock: number = 0): Promise<number> {
    const lastBlock = this.checkpoint?.lastProcessedBlock ?? fallbackBlock;

    this.logger.debug({
      lastProcessedBlock: lastBlock,
      usedFallback: this.checkpoint === null,
      fallbackBlock
    }, 'Retrieved last processed block');

    return lastBlock;
  }

  /**
   * Get checkpoint age in minutes for monitoring
   */
  getCheckpointAgeMinutes(): number | null {
    if (!this.checkpoint) {
      return null;
    }

    const now = new Date();
    const ageMs = now.getTime() - this.checkpoint.updatedAt.getTime();
    return Math.floor(ageMs / (1000 * 60));
  }

  /**
   * Get checkpoint summary for debugging
   */
  getCheckpointSummary() {
    return {
      exists: this.checkpoint !== null,
      lastProcessedBlock: this.checkpoint?.lastProcessedBlock,
      updatedAt: this.checkpoint?.updatedAt?.toISOString(),
      ageMinutes: this.getCheckpointAgeMinutes(),
      totalEventsProcessed: this.checkpoint?.metadata?.totalEventsProcessed
    };
  }
}