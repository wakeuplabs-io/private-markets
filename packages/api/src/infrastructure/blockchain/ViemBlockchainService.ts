/**
 * @fileoverview Viem implementation of blockchain service
 * Handles blockchain connectivity and event listening using viem library
 *
 * @module infrastructure/blockchain/ViemBlockchainService
 */

import { createPublicClient, http, parseAbi, type PublicClient, type Log, decodeEventLog } from 'viem';
import { localhost } from 'viem/chains';
import { IBlockchainService } from '../../domain/services/IBlockchainService';
import type { Logger } from 'pino';

/**
 * Event handler interface for processing blockchain events
 */
export interface IBlockchainEventHandler {
  handleBetReceived(log: Log): Promise<void>;
}

/**
 * Configuration for the blockchain service
 */
export interface BlockchainServiceConfig {
  rpcUrl: string;
  contractAddress: `0x${string}`;
  chainId: number;
  startBlock?: number;
}

/**
 * Viem-based implementation of blockchain service
 */
export class ViemBlockchainService implements IBlockchainService {
  private client: PublicClient | null = null;
  private unwatchEvents: (() => void) | null = null;
  private isCurrentlyListening = false;
  private connectionAttempts = 0;
  private readonly maxRetries = 5;

  // Contract ABI for the BetReceived event
  private readonly contractAbi = parseAbi([
    'event BetReceived(uint256 indexed marketId, bytes32 indexed betId, bool outcome, uint256 amount, bytes32 commitment)'
  ]);

  constructor(
    private config: BlockchainServiceConfig,
    private eventHandler: IBlockchainEventHandler,
    private logger: Logger
  ) {}

  async startListening(): Promise<void> {
    this.logger.info({
      rpcUrl: this.config.rpcUrl,
      contractAddress: this.config.contractAddress,
      chainId: this.config.chainId,
      startBlock: this.config.startBlock
    }, 'Blockchain listener starting');

    if (this.isCurrentlyListening) {
      this.logger.warn('Blockchain listener is already running');
      return;
    }

    try {
      await this.connectToBlockchain();
      await this.setupEventWatcher();

      this.isCurrentlyListening = true;
      this.connectionAttempts = 0;

      this.logger.info('Connected to blockchain, watching for BetReceived events');

    } catch (error) {
      this.connectionAttempts++;

      this.logger.error({
        error: error instanceof Error ? error.message : String(error),
        attempt: this.connectionAttempts,
        maxRetries: this.maxRetries
      }, 'Failed to start blockchain listener');

      if (this.connectionAttempts >= this.maxRetries) {
        throw new Error(`Failed to connect to blockchain after ${this.maxRetries} attempts`);
      }

      // Retry with exponential backoff
      const delay = Math.pow(2, this.connectionAttempts) * 1000;
      this.logger.info({ retryDelay: delay }, 'Retrying blockchain connection');

      setTimeout(() => {
        this.startListening();
      }, delay);
    }
  }

  async stopListening(): Promise<void> {
    this.logger.info('Stopping blockchain listener');

    if (this.unwatchEvents) {
      this.unwatchEvents();
      this.unwatchEvents = null;
    }

    this.isCurrentlyListening = false;
    this.client = null;

    this.logger.info('Blockchain listener stopped');
  }

  async getCurrentBlock(): Promise<number> {
    if (!this.client) {
      throw new Error('Blockchain client not connected');
    }

    try {
      const block = await this.client.getBlockNumber();
      const blockNumber = Number(block);

      this.logger.debug({ blockNumber }, 'Retrieved current block number');

      return blockNumber;
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to get current block number');

      throw error;
    }
  }

  isListening(): boolean {
    return this.isCurrentlyListening;
  }

  getConnectionStatus() {
    return {
      connected: this.isCurrentlyListening && this.client !== null,
      rpcUrl: this.config.rpcUrl,
      chainId: this.config.chainId,
      contractAddress: this.config.contractAddress
    };
  }

  /**
   * Establishes connection to the blockchain
   * @private
   */
  private async connectToBlockchain(): Promise<void> {
    this.logger.info('Establishing blockchain connection');

    this.client = createPublicClient({
      chain: {
        ...localhost,
        id: this.config.chainId
      },
      transport: http(this.config.rpcUrl)
    });

    // Test connection by getting current block
    const currentBlock = await this.getCurrentBlock();

    this.logger.info({
      currentBlock,
      chainId: this.config.chainId
    }, 'Blockchain connection established');
  }

  /**
   * Sets up event watcher for BetReceived events
   * @private
   */
  private async setupEventWatcher(): Promise<void> {
    if (!this.client) {
      throw new Error('Blockchain client not connected');
    }

    this.logger.info('Setting up BetReceived event watcher');

    this.unwatchEvents = this.client.watchContractEvent({
      address: this.config.contractAddress,
      abi: this.contractAbi,
      eventName: 'BetReceived',
      onLogs: (logs) => this.handleEventLogs(logs),
      onError: (error) => this.handleEventError(error),
      fromBlock: this.config.startBlock !== undefined ? BigInt(this.config.startBlock) : undefined
    });

    this.logger.info({
      contractAddress: this.config.contractAddress,
      fromBlock: this.config.startBlock ?? 'latest'
    }, 'Event watcher configured successfully');
  }

  /**
   * Handles incoming event logs
   * @private
   */
  private async handleEventLogs(logs: Log[]): Promise<void> {
    this.logger.info({
      eventCount: logs.length
    }, 'Received blockchain events');

    for (const log of logs) {
      try {
        // Decode the event log
        const decodedLog = decodeEventLog({
          abi: this.contractAbi,
          data: log.data,
          topics: log.topics
        });

        this.logger.info({
          event: 'BetReceived',
          marketId: Number(decodedLog.args.marketId),
          betId: decodedLog.args.betId,
          outcome: decodedLog.args.outcome,
          amount: decodedLog.args.amount?.toString(),
          commitment: decodedLog.args.commitment,
          blockNumber: Number(log.blockNumber),
          transactionHash: log.transactionHash,
          logIndex: log.logIndex
        }, 'Blockchain event detected');

        await this.eventHandler.handleBetReceived(log);

      } catch (error) {
        this.logger.error({
          error: error instanceof Error ? error.message : String(error),
          logData: {
            blockNumber: Number(log.blockNumber),
            transactionHash: log.transactionHash,
            logIndex: log.logIndex
          }
        }, 'Error processing blockchain event');

        // Don't rethrow - we want to continue processing other events
      }
    }
  }

  /**
   * Handles event watcher errors
   * @private
   */
  private handleEventError(error: Error): void {
    this.logger.error({
      error: error.message,
      stack: error.stack
    }, 'Event watching error occurred');

    // If we get disconnected, try to reconnect
    if (this.isCurrentlyListening) {
      this.logger.info('Attempting to restart event watcher');

      setTimeout(async () => {
        try {
          await this.stopListening();
          await this.startListening();
        } catch (restartError) {
          this.logger.error({
            error: restartError instanceof Error ? restartError.message : String(restartError)
          }, 'Failed to restart event watcher');
        }
      }, 5000);
    }
  }
}