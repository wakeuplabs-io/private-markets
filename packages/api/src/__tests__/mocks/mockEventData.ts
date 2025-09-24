/**
 * @fileoverview Mock event data for testing blockchain events
 * Provides realistic test data for BetReceived events
 *
 * @module __tests__/mocks/mockEventData
 */

import type { MockEventData } from './MockViemBlockchainService';

/**
 * Sample mock event data for testing
 */
export const mockBetReceivedEvents = {
  /**
   * A basic "Yes" bet on market 1
   */
  basicYesBet: {
    marketId: 1,
    betId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    outcome: true,
    amount: '1000000000000000000', // 1 ETH in wei
    commitment: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    blockNumber: 12345,
    transactionHash: '0xaabbccddee1122334455667788990011223344556677889900112233445566'
  } as MockEventData,

  /**
   * A basic "No" bet on market 1
   */
  basicNoBet: {
    marketId: 1,
    betId: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    outcome: false,
    amount: '500000000000000000', // 0.5 ETH in wei
    commitment: '0x0987654321abcdef0987654321abcdef0987654321abcdef0987654321abcdef',
    blockNumber: 12346,
    transactionHash: '0x1122334455667788990011223344556677889900aabbccddee1122334455'
  } as MockEventData,

  /**
   * A large bet on market 2
   */
  largeBet: {
    marketId: 2,
    betId: '0xbeefdead1337c0debeefdead1337c0debeefdead1337c0debeefdead1337c0de',
    outcome: true,
    amount: '10000000000000000000', // 10 ETH in wei
    commitment: '0xdeadbeef1337c0dedeadbeef1337c0dedeadbeef1337c0dedeadbeef1337c0',
    blockNumber: 12347,
    transactionHash: '0xdeadbeef13371337deadbeef13371337deadbeef13371337deadbeef1337'
  } as MockEventData,

  /**
   * Multiple bets for the same market - useful for testing aggregation
   */
  multipleBetsMarket1: [
    {
      marketId: 1,
      betId: '0xa111111111111111111111111111111111111111111111111111111111111111',
      outcome: true,
      amount: '2000000000000000000', // 2 ETH
      commitment: '0xc111111111111111111111111111111111111111111111111111111111111111',
      blockNumber: 12348
    },
    {
      marketId: 1,
      betId: '0xa222222222222222222222222222222222222222222222222222222222222222',
      outcome: false,
      amount: '1500000000000000000', // 1.5 ETH
      commitment: '0xc222222222222222222222222222222222222222222222222222222222222222',
      blockNumber: 12349
    },
    {
      marketId: 1,
      betId: '0xa333333333333333333333333333333333333333333333333333333333333333',
      outcome: true,
      amount: '3000000000000000000', // 3 ETH
      commitment: '0xc333333333333333333333333333333333333333333333333333333333333333',
      blockNumber: 12350
    }
  ] as MockEventData[]
};

/**
 * Helper function to create custom mock event data
 */
export function createMockBetEvent(overrides: Partial<MockEventData> = {}): MockEventData {
  return {
    marketId: 1,
    betId: '0x' + Array(64).fill('1').join(''),
    outcome: true,
    amount: '1000000000000000000',
    commitment: '0x' + Array(64).fill('a').join(''),
    blockNumber: 12345,
    transactionHash: '0x' + Array(64).fill('b').join(''),
    ...overrides
  };
}

/**
 * Helper to create multiple events for testing batch processing
 */
export function createMultipleMockEvents(count: number, marketId: number = 1): MockEventData[] {
  return Array.from({ length: count }, (_, i) => createMockBetEvent({
    marketId,
    betId: `0x${i.toString().padStart(64, '0')}`,
    outcome: i % 2 === 0, // Alternate between true/false
    amount: ((i + 1) * 100000000000000000).toString(), // Varying amounts
    commitment: `0x${(i + 100).toString().padStart(64, '0')}`,
    blockNumber: 12345 + i
  }));
}

/**
 * Expected API response structure for testing
 */
export interface ExpectedBetResponse {
  marketId: number;
  bets: Array<{
    commitment: string;
    amount: string;
    outcome: boolean;
    outcomeLabel: string;
    betId: string;
    blockNumber: number;
    timestamp: string;
  }>;
  totalBets: number;
  totalYes: number;
  totalNo: number;
  totalAmountYes: string;
  totalAmountNo: string;
}

/**
 * Helper to create expected API response for testing assertions
 */
export function createExpectedBetResponse(events: MockEventData[]): ExpectedBetResponse {
  const bets = events.map(event => ({
    commitment: event.commitment,
    amount: event.amount,
    outcome: event.outcome,
    outcomeLabel: event.outcome ? 'Yes' : 'No',
    betId: event.betId,
    blockNumber: event.blockNumber || 12345,
    timestamp: new Date().toISOString() // This will be dynamic in real tests
  }));

  const totalYes = events.filter(e => e.outcome).length;
  const totalNo = events.filter(e => !e.outcome).length;

  const totalAmountYes = events
    .filter(e => e.outcome)
    .reduce((sum, e) => sum + BigInt(e.amount), BigInt(0))
    .toString();

  const totalAmountNo = events
    .filter(e => !e.outcome)
    .reduce((sum, e) => sum + BigInt(e.amount), BigInt(0))
    .toString();

  return {
    marketId: events[0]?.marketId || 1,
    bets,
    totalBets: events.length,
    totalYes,
    totalNo,
    totalAmountYes,
    totalAmountNo
  };
}