/**
 * @fileoverview Test utilities and helpers for E2E tests
 * Provides app factory and testing utilities
 *
 * @module __tests__/utils/testHelpers
 */

import pino from 'pino';
import type { Logger } from 'pino';
import { expect } from 'vitest';
import createApp from '../../lib/create-app';
import { createMarketRouterWithContainer } from '../../interfaces/http/market/market.index';
import { Container } from '../../container/Container';
import { configureContainer, TYPES } from '../../container/bindings';
import { MockViemBlockchainService } from '../mocks/MockViemBlockchainService';
import { IBlockchainService } from '../../domain/services/IBlockchainService';
import { BlockchainEventHandler } from '../../interfaces/events/BlockchainEventHandler';
import type { AppOpenAPI } from '../../lib/types';
import indexRouter from '../../interfaces/http/index.route';

/**
 * Test app configuration with mocks
 */
export interface TestAppSetup {
  app: AppOpenAPI;
  mockBlockchainService: MockViemBlockchainService;
  container: Container;
  logger: Logger;
}

/**
 * Creates a test logger for debugging
 */
export function createTestLogger(): Logger {
  return pino({
    level: 'info', // Enable logs for debugging
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  });
}

/**
 * Creates a test container with mock blockchain service
 */
export function createTestContainer(logger: Logger): Container {
  const container = new Container();

  
  configureContainer(container, logger);

  
  const eventHandler = container.resolve<BlockchainEventHandler>(TYPES.BlockchainEventHandler);

  const mockBlockchainService = new MockViemBlockchainService(
    '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // Mock contract address
    eventHandler,
    logger
  );

  
  container.registerInstance<IBlockchainService>(
    TYPES.BlockchainService,
    mockBlockchainService
  );

  return container;
}

/**
 * [MAIN] Main test app factory
 * Creates a complete app instance with mocked blockchain service
 */
export function createTestApp(): TestAppSetup {
  const logger = createTestLogger();
  const container = createTestContainer(logger);

  
  const mockBlockchainService = container.resolve<IBlockchainService>(TYPES.BlockchainService) as MockViemBlockchainService;

  
  const app = createApp();

  
  const marketRouter = createMarketRouterWithContainer(container);

  
  app.route('/api', indexRouter);
  app.route('/api', marketRouter);

  return {
    app,
    mockBlockchainService,
    container,
    logger
  };
}

/**
 * Helper to wait for async operations in tests
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to validate bet response structure
 */
export function validateBetResponseStructure(response: any): void {
  expect(response).toHaveProperty('marketId');
  expect(response).toHaveProperty('bets');
  expect(response).toHaveProperty('totalBets');
  expect(response).toHaveProperty('totalYes');
  expect(response).toHaveProperty('totalNo');
  expect(response).toHaveProperty('totalAmountYes');
  expect(response).toHaveProperty('totalAmountNo');

  expect(Array.isArray(response.bets)).toBe(true);
  expect(typeof response.marketId).toBe('number');
  expect(typeof response.totalBets).toBe('number');
  expect(typeof response.totalYes).toBe('number');
  expect(typeof response.totalNo).toBe('number');
  expect(typeof response.totalAmountYes).toBe('string');
  expect(typeof response.totalAmountNo).toBe('string');
}

/**
 * Helper to validate individual bet structure
 */
export function validateBetStructure(bet: any): void {
  expect(bet).toHaveProperty('commitment');
  expect(bet).toHaveProperty('amount');
  expect(bet).toHaveProperty('outcome');
  expect(bet).toHaveProperty('outcomeLabel');
  expect(bet).toHaveProperty('betId');
  expect(bet).toHaveProperty('blockNumber');
  expect(bet).toHaveProperty('timestamp');

  expect(typeof bet.commitment).toBe('string');
  expect(typeof bet.amount).toBe('string');
  expect(typeof bet.outcome).toBe('boolean');
  expect(typeof bet.outcomeLabel).toBe('string');
  expect(typeof bet.betId).toBe('string');
  expect(typeof bet.blockNumber).toBe('number');
  expect(typeof bet.timestamp).toBe('string');

  
  expect(bet.outcomeLabel).toBe(bet.outcome ? 'Yes' : 'No');
}

/**
 * Helper to seed test markets if needed
 */
export async function seedTestMarkets(container: Container): Promise<void> {
  
  const logger = container.resolve<Logger>(TYPES.Logger);
  logger.info('Test markets seeded (using default test data)');
}

/**
 * Helper to assert BigInt string values in tests
 */
export function assertBigIntString(value: string, expectedWei: string): void {
  expect(value).toBe(expectedWei);
  expect(() => BigInt(value)).not.toThrow();
}

/**
 * Helper to convert wei to ETH for readable test output
 */
export function weiToEth(weiString: string): string {
  const wei = BigInt(weiString);
  const eth = Number(wei) / 1e18;
  return eth.toString();
}