/**
 * @fileoverview E2E tests for blockchain events → API flow
 * Tests the complete flow from mock blockchain events to API responses
 *
 * @module __tests__/e2e/blockchain-events.e2e.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestApp,
  validateBetResponseStructure,
  validateBetStructure,
  assertBigIntString,
  weiToEth,
  type TestAppSetup
} from '../utils/testHelpers';
import {
  mockBetReceivedEvents,
  createMockBetEvent,
  createMultipleMockEvents
} from '../mocks/mockEventData';

describe('E2E: Blockchain Events → API Flow', () => {
  let testSetup: TestAppSetup;

  beforeEach(async () => {
    // Create fresh test app for each test
    testSetup = createTestApp();

    // Start the mock blockchain service
    await testSetup.mockBlockchainService.startListening();
  });

  describe('Single Event Tests', () => {
    it('🎯 should trigger mock BetReceived event and retrieve via API', async () => {
      const { app, mockBlockchainService } = testSetup;
      const mockEvent = mockBetReceivedEvents.basicYesBet;

      // 🚀 TRIGGER: Dispatch mock blockchain event
      await mockBlockchainService.triggerBetReceivedEvent(mockEvent);

      // 🔍 VERIFY: Get bets via API
      const response = await app.request('/api/market/1/bets', {
        method: 'GET'
      });

      if (response.status !== 200) {
        const errorBody = await response.text();
        console.error(`API Error ${response.status}:`, errorBody);
        throw new Error(`API returned ${response.status}: ${errorBody}`);
      }

      expect(response.status).toBe(200);
      const responseBody = await response.json();

      // ✅ ASSERTIONS: Validate response structure
      validateBetResponseStructure(responseBody);

      // ✅ ASSERTIONS: Validate bet count and data
      expect(responseBody.marketId).toBe(1);
      expect(responseBody.totalBets).toBe(1);
      expect(responseBody.totalYes).toBe(1);
      expect(responseBody.totalNo).toBe(0);

      // ✅ ASSERTIONS: Validate amounts
      assertBigIntString(responseBody.totalAmountYes, mockEvent.amount);
      assertBigIntString(responseBody.totalAmountNo, '0');

      // ✅ ASSERTIONS: Validate bet details
      const bet = responseBody.bets[0];
      validateBetStructure(bet);
      expect(bet.betId).toBe(mockEvent.betId);
      expect(bet.outcome).toBe(mockEvent.outcome);
      expect(bet.outcomeLabel).toBe('Yes');
      expect(bet.amount).toBe(mockEvent.amount);
      expect(bet.commitment).toBe(mockEvent.commitment);
      expect(bet.blockNumber).toBe(mockEvent.blockNumber);

      console.log(`✅ Successfully processed mock bet: ${weiToEth(bet.amount)} ETH on ${bet.outcomeLabel}`);
    });

    it('should handle "No" outcome bet correctly', async () => {
      const { app, mockBlockchainService } = testSetup;
      const mockEvent = mockBetReceivedEvents.basicNoBet;

      // Trigger "No" bet event
      await mockBlockchainService.triggerBetReceivedEvent(mockEvent);

      const response = await app.request('/api/market/1/bets', {
        method: 'GET'
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();

      expect(responseBody.totalBets).toBe(1);
      expect(responseBody.totalYes).toBe(0);
      expect(responseBody.totalNo).toBe(1);
      assertBigIntString(responseBody.totalAmountYes, '0');
      assertBigIntString(responseBody.totalAmountNo, mockEvent.amount);

      const bet = responseBody.bets[0];
      expect(bet.outcome).toBe(false);
      expect(bet.outcomeLabel).toBe('No');
    });
  });

  describe('Multiple Events Tests', () => {
    it('should handle multiple events for same market', async () => {
      const { app, mockBlockchainService } = testSetup;
      const events = mockBetReceivedEvents.multipleBetsMarket1;

      // Trigger multiple events
      for (const event of events) {
        await mockBlockchainService.triggerBetReceivedEvent(event);
      }

      const response = await app.request('/api/market/1/bets', {
        method: 'GET'
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();

      expect(responseBody.totalBets).toBe(3);
      expect(responseBody.totalYes).toBe(2); // Two "Yes" bets in the mock data
      expect(responseBody.totalNo).toBe(1);  // One "No" bet in the mock data

      // Verify all bets are present
      expect(responseBody.bets).toHaveLength(3);

      // Verify amount totals
      const expectedYesTotal = BigInt('2000000000000000000') + BigInt('3000000000000000000'); // 5 ETH
      const expectedNoTotal = BigInt('1500000000000000000'); // 1.5 ETH

      assertBigIntString(responseBody.totalAmountYes, expectedYesTotal.toString());
      assertBigIntString(responseBody.totalAmountNo, expectedNoTotal.toString());

      console.log(`✅ Processed ${responseBody.totalBets} bets: ${responseBody.totalYes} Yes (${weiToEth(responseBody.totalAmountYes)} ETH), ${responseBody.totalNo} No (${weiToEth(responseBody.totalAmountNo)} ETH)`);
    });

    it('should handle batch event processing', async () => {
      const { app, mockBlockchainService } = testSetup;
      const batchEvents = createMultipleMockEvents(5, 1); // 5 events for market 1

      // Trigger all events in batch
      await mockBlockchainService.triggerMultipleEvents(batchEvents);

      const response = await app.request('/api/market/1/bets', {
        method: 'GET'
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();

      expect(responseBody.totalBets).toBe(5);
      expect(responseBody.bets).toHaveLength(5);

      // Verify alternating outcomes (as per createMultipleMockEvents logic)
      const yesBets = responseBody.bets.filter((bet: any) => bet.outcome === true);
      const noBets = responseBody.bets.filter((bet: any) => bet.outcome === false);

      expect(yesBets).toHaveLength(3); // Events 0, 2, 4 (true)
      expect(noBets).toHaveLength(2);  // Events 1, 3 (false)
    });
  });

  describe('Market Isolation Tests', () => {
    it('should isolate bets by market ID', async () => {
      const { app, mockBlockchainService } = testSetup;

      // Create events for different markets with unique commitments
      const market1Event = createMockBetEvent({
        marketId: 1,
        commitment: '0x' + Array(64).fill('1').join('')
      });
      const market2Event = createMockBetEvent({
        marketId: 2,
        commitment: '0x' + Array(64).fill('2').join('')
      });
      const market3Event = createMockBetEvent({
        marketId: 3,
        commitment: '0x' + Array(64).fill('3').join('')
      });

      // Trigger events for different markets
      await mockBlockchainService.triggerBetReceivedEvent(market1Event);
      await mockBlockchainService.triggerBetReceivedEvent(market2Event);
      await mockBlockchainService.triggerBetReceivedEvent(market3Event);

      // Check market 1 - should only have 1 bet
      const response1 = await app.request('/api/market/1/bets', {
        method: 'GET'
      });

      expect(response1.status).toBe(200);
      const responseBody1 = await response1.json();
      expect(responseBody1.marketId).toBe(1);
      expect(responseBody1.totalBets).toBe(1);

      // Check market 2 - should only have 1 bet
      const response2 = await app.request('/api/market/2/bets', {
        method: 'GET'
      });

      expect(response2.status).toBe(200);
      const responseBody2 = await response2.json();
      expect(responseBody2.marketId).toBe(2);
      expect(responseBody2.totalBets).toBe(1);

      // Check market 3 - should only have 1 bet
      const response3 = await app.request('/api/market/3/bets', {
        method: 'GET'
      });

      expect(response3.status).toBe(200);
      const responseBody3 = await response3.json();
      expect(responseBody3.marketId).toBe(3);
      expect(responseBody3.totalBets).toBe(1);

      console.log(`✅ Market isolation verified: M1(${responseBody1.totalBets}), M2(${responseBody2.totalBets}), M3(${responseBody3.totalBets})`);
    });
  });

  describe('Edge Cases', () => {
    it('should return empty bets for market with no events', async () => {
      const { app } = testSetup;

      // Don't trigger any events, just query
      const response = await app.request('/api/market/1/bets', {
        method: 'GET'
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();

      validateBetResponseStructure(responseBody);
      expect(responseBody.marketId).toBe(1);
      expect(responseBody.totalBets).toBe(0);
      expect(responseBody.totalYes).toBe(0);
      expect(responseBody.totalNo).toBe(0);
      expect(responseBody.bets).toHaveLength(0);
      assertBigIntString(responseBody.totalAmountYes, '0');
      assertBigIntString(responseBody.totalAmountNo, '0');
    });

    it('should handle large bet amounts', async () => {
      const { app, mockBlockchainService } = testSetup;

      const largeBetEvent = createMockBetEvent({
        amount: '100000000000000000000', // 100 ETH
        outcome: true
      });

      await mockBlockchainService.triggerBetReceivedEvent(largeBetEvent);

      const response = await app.request('/api/market/1/bets', {
        method: 'GET'
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();

      expect(responseBody.totalBets).toBe(1);
      assertBigIntString(responseBody.totalAmountYes, '100000000000000000000');

      const bet = responseBody.bets[0];
      expect(bet.amount).toBe('100000000000000000000');

      console.log(`✅ Large bet processed: ${weiToEth(bet.amount)} ETH`);
    });
  });

  describe('API Error Handling', () => {
    it('should return empty results for non-existent market', async () => {
      const { app } = testSetup;

      const response = await app.request('/api/market/9999/bets', {
        method: 'GET'
      });

      expect(response.status).toBe(200);
      const responseBody = await response.json();

      // Non-existent markets should return empty bet results
      validateBetResponseStructure(responseBody);
      expect(responseBody.marketId).toBe(9999);
      expect(responseBody.totalBets).toBe(0);
      expect(responseBody.bets).toHaveLength(0);
      assertBigIntString(responseBody.totalAmountYes, '0');
      assertBigIntString(responseBody.totalAmountNo, '0');
    });

    it('should return 400 for invalid market ID', async () => {
      const { app } = testSetup;

      const response = await app.request('/api/market/invalid/bets', {
        method: 'GET'
      });

      expect(response.status).toBe(422); // Zod validation error
    });
  });

  describe('Service Status', () => {
    it('should verify mock blockchain service is working', async () => {
      const { mockBlockchainService } = testSetup;

      expect(mockBlockchainService.isListening()).toBe(true);

      const status = mockBlockchainService.getConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.rpcUrl).toBe('mock://localhost:8545');
      expect(status.chainId).toBe(31337);

      const currentBlock = await mockBlockchainService.getCurrentBlock();
      expect(currentBlock).toBe(12345);

      console.log('✅ Mock blockchain service status verified');
    });
  });
});