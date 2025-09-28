/**
 * @fileoverview Mock implementation of ViemBlockchainService for testing
 * Simulates blockchain events without requiring actual blockchain connection
 *
 * @module __tests__/mocks/MockViemBlockchainService
 */

import type { Log } from 'viem';
import { parseAbi, encodeEventTopics, encodeAbiParameters, parseAbiParameters } from 'viem';
import type { Logger } from 'pino';
import { IBlockchainService } from '../../domain/services/IBlockchainService';
import type { IBlockchainEventHandler } from '../../infrastructure/blockchain/ViemBlockchainService';

/**
 * Mock event data structure for creating test events
 */
export interface MockEventData {
  marketId: number;
  betId: string;
  outcome: boolean;
  amount: string;
  commitment: string;
  blockNumber?: number;
  transactionHash?: string;
}

/**
 * Mock implementation of ViemBlockchainService
 * Allows triggering events manually for testing purposes
 */
export class MockViemBlockchainService implements IBlockchainService {
  private connected = false;
  private listening = false;

  // Store historical logs for testing historical scanning
  private storedLogs: Map<number, Log[]> = new Map();

  // Contract ABI for the BetReceived event
  private readonly contractAbi = parseAbi([
    'event BetReceived(uint256 indexed marketId, bytes32 indexed betId, bool outcome, uint256 amount, bytes32 commitment)'
  ]);

  constructor(
    private contractAddress: `0x${string}`,
    private eventHandler: IBlockchainEventHandler,
    private logger: Logger
  ) {}

  /**
   * Mock connection - doesn't actually connect to blockchain
   */
  async connectToBlockchain(): Promise<void> {
    this.connected = true;
    this.logger.info({
      contractAddress: this.contractAddress,
      rpcUrl: 'mock://localhost:8545'
    }, 'Mock blockchain connection established');
  }

  /**
   * Starts listening - just sets flag, no actual blockchain watching
   */
  async startListening(): Promise<void> {
    if (!this.connected) {
      await this.connectToBlockchain();
    }

    this.listening = true;
    this.logger.info('Mock blockchain listener started');
  }

  /**
   * Stops listening
   */
  async stopListening(): Promise<void> {
    this.listening = false;
    this.logger.info('Mock blockchain listener stopped');
  }

  /**
   * Mock current block number
   */
  async getCurrentBlock(): Promise<number> {
    return 12345; // Mock block number
  }

  /**
   * Check if service is listening
   */
  isListening(): boolean {
    return this.listening;
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      connected: this.connected,
      rpcUrl: 'mock://localhost:8545',
      chainId: 31337,
      contractAddress: this.contractAddress
    };
  }

  /**
   * [KEY METHOD] Trigger a BetReceived event for testing
   * This bypasses the blockchain watcher and calls the handler directly
   */
  async triggerBetReceivedEvent(eventData: MockEventData): Promise<void> {
    if (!this.listening) {
      throw new Error('Mock blockchain service is not listening');
    }

    const mockLog = this.createMockLog(eventData);

    // Store the log for historical scanning
    const blockNumber = Number(mockLog.blockNumber);
    if (!this.storedLogs.has(blockNumber)) {
      this.storedLogs.set(blockNumber, []);
    }
    this.storedLogs.get(blockNumber)!.push(mockLog);

    this.logger.info({
      event: 'BetReceived',
      marketId: eventData.marketId,
      betId: eventData.betId,
      outcome: eventData.outcome,
      amount: eventData.amount,
      commitment: eventData.commitment
    }, 'Triggering mock BetReceived event');

    // Call handler directly - this is the key to our testing strategy
    try {
      await this.eventHandler.handleBetReceived(mockLog);
      this.logger.info('Mock event handler completed successfully');
    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : String(error)
      }, 'Mock event handler failed');
      throw error;
    }
  }

  /**
   * Creates a properly formatted viem Log for testing
   * Made public for advanced testing scenarios
   */
  createMockLog(data: MockEventData): Log {
    // Generate encoded topics for the event
    const topics = encodeEventTopics({
      abi: this.contractAbi,
      eventName: 'BetReceived',
      args: {
        marketId: BigInt(data.marketId),
        betId: data.betId as `0x${string}`
      }
    });

    // Create mock log data - viem expects specific format
    const mockData = this.encodeMockEventData(data);

    return {
      address: this.contractAddress,
      blockHash: `0x${Array(64).fill('a').join('')}` as `0x${string}`,
      blockNumber: BigInt(data.blockNumber || 12345),
      data: mockData,
      logIndex: 0,
      removed: false,
      topics: topics as [`0x${string}`, ...`0x${string}`[]],
      transactionHash: (data.transactionHash || `0x${Array(64).fill('b').join('')}`) as `0x${string}`,
      transactionIndex: 0
    };
  }

  /**
   * Encodes event data in the format viem expects
   * @private
   */
  private encodeMockEventData(data: MockEventData): `0x${string}` {
    // Properly encode the non-indexed parameters using viem
    // Indexed parameters (marketId, betId) go in topics, non-indexed go in data
    return encodeAbiParameters(
      parseAbiParameters('bool, uint256, bytes32'),
      [
        data.outcome,
        BigInt(data.amount),
        data.commitment as `0x${string}`
      ]
    );
  }

  /**
   * Helper method to trigger multiple events at once
   */
  async triggerMultipleEvents(events: MockEventData[]): Promise<void> {
    for (const event of events) {
      await this.triggerBetReceivedEvent(event);
    }
  }

  /**
   * Mock implementation of getLogs for historical scanning
   * Returns logs that were previously stored via triggerBetReceivedEvent
   */
  async getLogs(fromBlock: number, toBlock: number): Promise<Log[]> {
    this.logger.debug({
      fromBlock,
      toBlock,
      blockRange: toBlock - fromBlock + 1
    }, 'Mock getLogs called');

    const logs: Log[] = [];

    // Iterate through the block range and collect stored logs
    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
      const blockLogs = this.storedLogs.get(blockNumber) || [];
      logs.push(...blockLogs);
    }

    this.logger.debug({
      fromBlock,
      toBlock,
      logsFound: logs.length
    }, 'Mock getLogs returning logs');

    return logs;
  }

  /**
   * Mock implementation of processHistoricalLogs
   * Processes logs by calling the event handler for each one
   */
  async processHistoricalLogs(logs: Log[]): Promise<number> {
    let processedCount = 0;

    this.logger.info({
      totalLogs: logs.length
    }, 'Mock processHistoricalLogs called');

    for (const log of logs) {
      try {
        await this.eventHandler.handleBetReceived(log);
        processedCount++;
      } catch (error) {
        this.logger.error({
          error: error instanceof Error ? error.message : String(error),
          logData: {
            blockNumber: Number(log.blockNumber),
            transactionHash: log.transactionHash
          }
        }, 'Error processing historical log in mock');
        // Continue processing other logs rather than failing entire batch
      }
    }

    this.logger.info({
      totalLogs: logs.length,
      processedCount
    }, 'Mock processHistoricalLogs completed');

    return processedCount;
  }

  /**
   * Helper method to clear stored logs (useful for test cleanup)
   */
  clearStoredLogs(): void {
    this.storedLogs.clear();
    this.logger.debug('Cleared stored logs');
  }

  /**
   * Helper method to get stored logs count (for debugging)
   */
  getStoredLogsCount(): number {
    let total = 0;
    for (const logs of this.storedLogs.values()) {
      total += logs.length;
    }
    return total;
  }
}