/**
 * @fileoverview Debug test to understand refresh behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, type TestAppSetup } from '../utils/testHelpers';
import { createMockBetEvent } from '../mocks/mockEventData';

describe('Debug: Refresh Behavior', () => {
  let testSetup: TestAppSetup;

  beforeEach(async () => {
    testSetup = createTestApp();
    await testSetup.mockBlockchainService.startListening();
    (testSetup.mockBlockchainService as any).clearStoredLogs();
  });

  it('Should debug event storage and refresh process', async () => {
    const { app, mockBlockchainService } = testSetup;

    // Store 3 simple events in different blocks
    const events = [
      {
        marketId: 1, commitment: '0x1111111111111111111111111111111111111111111111111111111111111111',
        amount: '1000000000000000000', outcome: true,
        betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1', blockNumber: 100
      },
      {
        marketId: 1, commitment: '0x2222222222222222222222222222222222222222222222222222222222222222',
        amount: '500000000000000000', outcome: true,
        betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2', blockNumber: 101
      },
      {
        marketId: 1, commitment: '0x3333333333333333333333333333333333333333333333333333333333333333',
        amount: '2000000000000000000', outcome: true,
        betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3', blockNumber: 102
      }
    ];

    // Manually store events
    for (const event of events) {
      const mockEvent = createMockBetEvent(event);
      const mockLog = (mockBlockchainService as any).createMockLog(mockEvent);

      const storedLogs = (mockBlockchainService as any).storedLogs;
      if (!storedLogs.has(event.blockNumber)) {
        storedLogs.set(event.blockNumber, []);
      }
      storedLogs.get(event.blockNumber).push(mockLog);
    }

    // Check stored logs count
    const storedCount = (mockBlockchainService as any).getStoredLogsCount();
    console.log(`📦 Stored events: ${storedCount}`);

    // Test getLogs method directly
    const retrievedLogs = await (mockBlockchainService as any).getLogs(100, 102);
    console.log(`🔍 Retrieved logs: ${retrievedLogs.length}`);

    // Test processHistoricalLogs method directly
    const processedCount = await (mockBlockchainService as any).processHistoricalLogs(retrievedLogs);
    console.log(`⚙️  Processed logs: ${processedCount}`);

    // Check how many bets are now in the system
    const betsResponse = await app.request('/api/market/1/bets', { method: 'GET' });
    const bets = await betsResponse.json();
    console.log(`💾 Bets in system: ${bets.totalBets}`);

    // Now test refresh
    const refreshResponse = await app.request('/api/system/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromBlock: 100, toBlock: 102 })
    });

    const refresh = await refreshResponse.json();
    console.log(`🔄 Refresh result: ${refresh.eventsProcessed} events processed`);
    console.log(`📊 Full refresh data:`, JSON.stringify(refresh, null, 2));
  });
});