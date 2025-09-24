/**
 * @fileoverview Blockchain event handler
 * Processes blockchain events and delegates to appropriate use cases
 *
 * @module interfaces/events/BlockchainEventHandler
 */

import type { Log } from 'viem';
import { decodeEventLog, parseAbi } from 'viem';
import type { Logger } from 'pino';
import { StoreBet, DuplicateBetError, InvalidBetDataError } from '../../application/use-cases/StoreBet';
import { BlockchainEventDTO } from '../../application/dto/BlockchainEventDTO';
import type { IBlockchainEventHandler } from '../../infrastructure/blockchain/ViemBlockchainService';

/**
 * Error thrown when event log data is malformed
 */
export class MalformedEventError extends Error {
  constructor(reason: string, log: Log) {
    super(`Malformed event log: ${reason}`);
    this.name = 'MalformedEventError';

    // Add log context for debugging
    Object.assign(this, { log });
  }
}

/**
 * Handles blockchain events and processes them through use cases
 */
export class BlockchainEventHandler implements IBlockchainEventHandler {
  // Contract ABI for the BetReceived event
  private readonly contractAbi = parseAbi([
    'event BetReceived(uint256 indexed marketId, bytes32 indexed betId, bool outcome, uint256 amount, bytes32 commitment)'
  ]);

  constructor(
    private storeBet: StoreBet,
    private logger: Logger
  ) {}

  /**
   * Handles BetReceived events from the blockchain
   * @param log - The event log from viem
   */
  async handleBetReceived(log: Log): Promise<void> {
    try {
      this.logger.info({
        blockNumber: Number(log.blockNumber),
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        address: log.address
      }, 'Processing BetReceived event');

      // Extract and validate event arguments
      const eventData = this.extractEventData(log);

      // Log the extracted event data
      this.logger.info({
        marketId: eventData.marketId,
        betId: eventData.betId,
        outcome: eventData.outcome,
        outcomeLabel: eventData.outcome ? 'Yes' : 'No',
        amount: eventData.amount.toString(),
        commitment: eventData.commitment,
        blockNumber: eventData.blockNumber,
        transactionHash: eventData.transactionHash
      }, 'Extracted event data successfully');

      // Process the bet through the use case
      await this.storeBet.execute(eventData);

      this.logger.info({
        marketId: eventData.marketId,
        commitment: eventData.commitment,
        processed: true
      }, 'BetReceived event processed successfully');

    } catch (error) {
      if (error instanceof DuplicateBetError) {
        this.logger.warn({
          blockNumber: Number(log.blockNumber),
          transactionHash: log.transactionHash,
          error: error.message
        }, 'Duplicate bet detected, skipping');
        return;
      }

      if (error instanceof InvalidBetDataError) {
        this.logger.error({
          blockNumber: Number(log.blockNumber),
          transactionHash: log.transactionHash,
          error: error.message,
          invalidData: (error as any).data
        }, 'Invalid bet data in event');
        return;
      }

      if (error instanceof MalformedEventError) {
        this.logger.error({
          blockNumber: Number(log.blockNumber),
          transactionHash: log.transactionHash,
          error: error.message,
          logData: (error as any).log
        }, 'Malformed event log structure');
        return;
      }

      // Unexpected error - log and rethrow
      this.logger.error({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        blockNumber: Number(log.blockNumber),
        transactionHash: log.transactionHash,
        logData: {
          address: log.address,
          topics: log.topics,
          data: log.data
        }
      }, 'Unexpected error processing BetReceived event');

      throw error;
    }
  }

  /**
   * Extracts and validates event data from a viem log
   * @private
   */
  private extractEventData(log: Log): BlockchainEventDTO {
    let decodedLog: any;
    try {
      // Decode the event log
      decodedLog = decodeEventLog({
        abi: this.contractAbi,
        data: log.data,
        topics: log.topics
      });
    } catch (error) {
      throw new MalformedEventError('Failed to decode event log', log);
    }

    const args = decodedLog.args;

    // Validate required fields exist
    if (args.marketId === undefined) {
      throw new MalformedEventError('Missing marketId in event args', log);
    }

    if (args.betId === undefined) {
      throw new MalformedEventError('Missing betId in event args', log);
    }

    if (args.outcome === undefined) {
      throw new MalformedEventError('Missing outcome in event args', log);
    }

    if (args.amount === undefined) {
      throw new MalformedEventError('Missing amount in event args', log);
    }

    if (args.commitment === undefined) {
      throw new MalformedEventError('Missing commitment in event args', log);
    }

    if (!log.blockNumber) {
      throw new MalformedEventError('Missing blockNumber in log', log);
    }

    if (!log.transactionHash) {
      throw new MalformedEventError('Missing transactionHash in log', log);
    }

    // Extract and convert data types
    try {
      const eventData: BlockchainEventDTO = {
        marketId: Number(args.marketId),
        betId: String(args.betId),
        outcome: Boolean(args.outcome),
        amount: BigInt(args.amount),
        commitment: String(args.commitment),
        blockNumber: Number(log.blockNumber),
        transactionHash: String(log.transactionHash)
      };

      this.logger.debug({
        extracted: {
          marketId: eventData.marketId,
          betId: eventData.betId,
          outcome: eventData.outcome,
          commitment: eventData.commitment,
          blockNumber: eventData.blockNumber
        }
      }, 'Event data extraction completed');

      return eventData;

    } catch (conversionError) {
      this.logger.error({
        conversionError: conversionError instanceof Error ? conversionError.message : String(conversionError),
        rawArgs: args
      }, 'Error converting event argument types');

      throw new MalformedEventError(
        `Type conversion failed: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`,
        log
      );
    }
  }

  /**
   * Gets handler statistics for monitoring
   */
  getStatistics(): {
    handlerName: string;
    isReady: boolean;
  } {
    return {
      handlerName: 'BlockchainEventHandler',
      isReady: true
    };
  }
}