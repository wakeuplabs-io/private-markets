/**
 * @fileoverview Scan Historical Events use case
 * Handles scanning blockchain for missed events during downtime
 *
 * @module application/use-cases/ScanHistoricalEvents
 */

import { IBlockchainService } from '../../domain/services/IBlockchainService';
import { ICheckpointRepository } from '../../domain/repositories/ICheckpointRepository';
import type { Logger } from 'pino';
import env from '../../env';

/**
 * Parameters for historical event scanning
 */
export interface ScanHistoricalEventsRequest {
  /** Force scan from specific block (optional) */
  fromBlock?: number;
  /** Scan until specific block (optional, defaults to current) */
  toBlock?: number;
  /** Force rescan even if already processed (optional) */
  forceRescan?: boolean;
}

/**
 * Result of historical event scanning
 */
export interface ScanHistoricalEventsResult {
  /** Number of blocks scanned */
  blocksScanned: number;
  /** Number of events found and processed */
  eventsProcessed: number;
  /** Block range that was scanned */
  scannedRange: {
    fromBlock: number;
    toBlock: number;
  };
  /** Time taken for the scan in milliseconds */
  scanTimeMs: number;
  /** Whether this was a forced rescan */
  wasForceRescan: boolean;
}

/**
 * Custom error for historical event scanning failures
 */
export class HistoricalScanError extends Error {
  constructor(
    message: string,
    public code: 'BLOCKCHAIN_UNAVAILABLE' | 'INVALID_BLOCK_RANGE' | 'SCAN_FAILED' | 'CHECKPOINT_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'HistoricalScanError';
  }
}

/**
 * Use case for scanning historical blockchain events
 * Implements smart window scanning with checkpoint management
 */
export class ScanHistoricalEvents {
  constructor(
    private blockchainService: IBlockchainService,
    private checkpointRepository: ICheckpointRepository,
    private logger: Logger
  ) {}

  async execute(request: ScanHistoricalEventsRequest = {}): Promise<ScanHistoricalEventsResult> {
    const startTime = Date.now();

    this.logger.info({
      request
    }, 'Starting historical events scan');

    try {
      // Get current blockchain state
      const currentBlock = await this.blockchainService.getCurrentBlock();

      // Determine scan range
      const scanRange = await this.calculateScanRange(currentBlock, request);

      this.logger.info({
        fromBlock: scanRange.fromBlock,
        toBlock: scanRange.toBlock,
        blocksToScan: scanRange.toBlock - scanRange.fromBlock + 1,
        forceRescan: request.forceRescan
      }, 'Calculated scan range');

      // Validate range
      if (scanRange.fromBlock > scanRange.toBlock) {
        throw new HistoricalScanError(
          'Invalid block range: fromBlock > toBlock',
          'INVALID_BLOCK_RANGE',
          scanRange
        );
      }

      // Perform the scan
      const eventsProcessed = await this.performBatchScan(scanRange);

      // Update checkpoint with latest block
      await this.checkpointRepository.updateCheckpoint(scanRange.toBlock, {
        totalEventsProcessed: eventsProcessed,
        lastEventTxHash: undefined // Could be enhanced to track last TX hash
      });

      const scanTimeMs = Date.now() - startTime;

      const result: ScanHistoricalEventsResult = {
        blocksScanned: scanRange.toBlock - scanRange.fromBlock + 1,
        eventsProcessed,
        scannedRange: scanRange,
        scanTimeMs,
        wasForceRescan: !!request.forceRescan
      };

      this.logger.info({
        ...result
      }, 'Historical events scan completed successfully');

      return result;

    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : String(error),
        request,
        scanTimeMs: Date.now() - startTime
      }, 'Historical events scan failed');

      if (error instanceof HistoricalScanError) {
        throw error;
      }

      throw new HistoricalScanError(
        `Historical scan failed: ${error instanceof Error ? error.message : String(error)}`,
        'SCAN_FAILED',
        error
      );
    }
  }

  /**
   * Calculates the optimal block range to scan
   */
  private async calculateScanRange(currentBlock: number, request: ScanHistoricalEventsRequest) {
    try {
      const lastProcessedBlock = await this.checkpointRepository.getLastProcessedBlock(0);

      let fromBlock: number;
      let toBlock: number;

      // Determine toBlock
      if (request.toBlock !== undefined) {
        toBlock = Math.min(request.toBlock, currentBlock);
      } else {
        toBlock = currentBlock;
      }

      // Determine fromBlock using smart window logic
      if (request.fromBlock !== undefined) {
        fromBlock = request.fromBlock;
      } else if (request.forceRescan) {
        // Force rescan from max scan window
        fromBlock = Math.max(currentBlock - env.MAX_SCAN_BLOCKS, env.START_BLOCK);
      } else {
        // Smart recovery: scan from last checkpoint or within window
        const windowStartBlock = currentBlock - env.MAX_SCAN_BLOCKS;
        fromBlock = Math.max(
          windowStartBlock,           // Don't go beyond our 1-month window
          env.START_BLOCK,           // Don't go before contract deployment
          lastProcessedBlock + 1     // Start from after last processed block
        );
      }

      return { fromBlock, toBlock };

    } catch (error) {
      throw new HistoricalScanError(
        'Failed to calculate scan range',
        'CHECKPOINT_ERROR',
        error
      );
    }
  }

  /**
   * Performs batch scanning of block ranges
   */
  private async performBatchScan(scanRange: { fromBlock: number; toBlock: number }): Promise<number> {
    const BATCH_SIZE = 1000; // Process 1000 blocks at a time
    let totalEventsProcessed = 0;
    let currentFromBlock = scanRange.fromBlock;

    while (currentFromBlock <= scanRange.toBlock) {
      const currentToBlock = Math.min(currentFromBlock + BATCH_SIZE - 1, scanRange.toBlock);

      this.logger.debug({
        batchFromBlock: currentFromBlock,
        batchToBlock: currentToBlock,
        remainingBlocks: scanRange.toBlock - currentToBlock
      }, 'Processing batch');

      try {
        // Note: This would require extending IBlockchainService with a getLogs method
        // For now, we'll simulate the batch processing
        const batchEvents = await this.scanBlockRange(currentFromBlock, currentToBlock);
        totalEventsProcessed += batchEvents;

        this.logger.debug({
          batchFromBlock: currentFromBlock,
          batchToBlock: currentToBlock,
          batchEvents,
          totalEventsProcessed
        }, 'Batch processed successfully');

      } catch (error) {
        this.logger.error({
          batchFromBlock: currentFromBlock,
          batchToBlock: currentToBlock,
          error: error instanceof Error ? error.message : String(error)
        }, 'Failed to process batch, continuing...');

        // Continue with next batch rather than failing entire scan
      }

      currentFromBlock = currentToBlock + 1;
    }

    return totalEventsProcessed;
  }

  /**
   * Scans a specific block range for events
   */
  private async scanBlockRange(fromBlock: number, toBlock: number): Promise<number> {
    this.logger.debug({
      fromBlock,
      toBlock,
      blockRange: toBlock - fromBlock + 1
    }, 'Scanning block range for historical events');

    try {
      // Get historical logs from blockchain service
      // Note: This assumes ViemBlockchainService has getLogs() and processHistoricalLogs() methods
      const blockchainService = this.blockchainService as any;

      if (!blockchainService.getLogs || !blockchainService.processHistoricalLogs) {
        this.logger.warn('Blockchain service does not support historical scanning');
        return 0;
      }

      const logs = await blockchainService.getLogs(fromBlock, toBlock);
      const eventsProcessed = await blockchainService.processHistoricalLogs(logs);

      this.logger.debug({
        fromBlock,
        toBlock,
        logsFound: logs.length,
        eventsProcessed
      }, 'Block range scan completed');

      return eventsProcessed;

    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : String(error),
        fromBlock,
        toBlock
      }, 'Failed to scan block range');

      // Return 0 rather than throwing to allow batch processing to continue
      return 0;
    }
  }
}