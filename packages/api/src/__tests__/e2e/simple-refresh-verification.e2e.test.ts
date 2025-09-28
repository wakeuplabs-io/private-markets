/**
 * @fileoverview Simplified E2E test for refresh verification with known Merkle roots
 * Focuses on the core flow: mock → refresh → resolve → verify root
 *
 * @module __tests__/e2e/simple-refresh-verification.e2e.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestApp,
  assertBigIntString,
  type TestAppSetup
} from '../utils/testHelpers';
import { createMockBetEvent } from '../mocks/mockEventData';

describe('E2E: Simple Refresh → Verification Flow', () => {
  let testSetup: TestAppSetup;

  beforeEach(async () => {
    testSetup = createTestApp();
    await testSetup.mockBlockchainService.startListening();
    (testSetup.mockBlockchainService as any).clearStoredLogs();
  });

  it('[CORE] Should process 3 winners through refresh and verify known Merkle root', async () => {
    const { app, mockBlockchainService } = testSetup;

    // Step 1: Store events in historical log storage (without immediate processing)
    const winners = [
      {
        marketId: 1, commitment: '0x1111111111111111111111111111111111111111111111111111111111111111',
        amount: '1000000000000000000', outcome: true,
        betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1', blockNumber: 1000
      },
      {
        marketId: 1, commitment: '0x2222222222222222222222222222222222222222222222222222222222222222',
        amount: '500000000000000000', outcome: true,
        betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2', blockNumber: 1001
      },
      {
        marketId: 1, commitment: '0x3333333333333333333333333333333333333333333333333333333333333333',
        amount: '2000000000000000000', outcome: true,
        betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3', blockNumber: 1002
      }
    ];

    const losers = [
      {
        marketId: 1, commitment: '0x4444444444444444444444444444444444444444444444444444444444444444',
        amount: '1500000000000000000', outcome: false,
        betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa4', blockNumber: 1003
      },
      {
        marketId: 1, commitment: '0x5555555555555555555555555555555555555555555555555555555555555555',
        amount: '800000000000000000', outcome: false,
        betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5', blockNumber: 1004
      }
    ];

    // Store all events in the mock blockchain service's storage
    const allBets = [...winners, ...losers];
    for (const bet of allBets) {
      const mockEvent = createMockBetEvent(bet);
      const mockLog = (mockBlockchainService as any).createMockLog(mockEvent);
      const blockNumber = bet.blockNumber;

      const storedLogs = (mockBlockchainService as any).storedLogs;
      if (!storedLogs.has(blockNumber)) {
        storedLogs.set(blockNumber, []);
      }
      storedLogs.get(blockNumber).push(mockLog);
    }

    console.log(`[OK] Stored ${allBets.length} events in blocks 1000-1004`);

    // Step 2: Perform refresh to process stored events
    const refreshResponse = await app.request('/api/system/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromBlock: 1000,
        toBlock: 1004
      })
    });

    expect(refreshResponse.status).toBe(200);
    const refresh = await refreshResponse.json();

    console.log(`[REFRESH] Refresh result: ${refresh.eventsProcessed} events processed`);

    // Step 3: Resolve market
    const resolveResponse = await app.request('/api/market/1/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winningOutcome: true })
    });

    expect(resolveResponse.status).toBe(200);
    const resolution = await resolveResponse.json();

    // Step 4: Verify basic resolution properties
    expect(resolution.marketId).toBe(1);
    expect(resolution.winningOutcome).toBe(1);
    expect(resolution.winnerCount).toBe(3);
    assertBigIntString(resolution.totalWinners, '3500000000000000000'); // 1 + 0.5 + 2 = 3.5 ETH
    assertBigIntString(resolution.totalPool, '5800000000000000000');  // 3.5 + 1.5 + 0.8 = 5.8 ETH

    // Step 5: Verify the Merkle root matches our expected value
    const expectedRoot = '0x5edd890bc39b2a04f6b82f3e1749eb23e74d5cccaf8801b99bfb75c93b1add8b';
    expect(resolution.root).toBe(expectedRoot);

    console.log(`[SUCCESS] SUCCESS: Root matches expected value!`);
    console.log(`   Expected: ${expectedRoot}`);
    console.log(`   Actual:   ${resolution.root}`);
    console.log(`   Match:    ${resolution.root === expectedRoot ? '[OK]' : '[FAIL]'}`);

    // Step 6: Validate individual proofs for winners
    for (const winner of winners) {
      const proofResponse = await app.request(`/api/proof/${winner.commitment}`, {
        method: 'GET'
      });

      expect(proofResponse.status).toBe(200);
      const proof = await proofResponse.json();

      expect(proof.found).toBe(true);
      expect(proof.commitment).toBe(winner.commitment);
      expect(proof.amount).toBe(winner.amount);
      expect(proof.root).toBe(expectedRoot);
      expect(Array.isArray(proof.proof)).toBe(true);

      console.log(`  [OK] ${winner.commitment.slice(0, 10)}... proof valid (${proof.proof.length} siblings)`);
    }

    // Step 7: Verify losers have no proofs
    for (const loser of losers) {
      const proofResponse = await app.request(`/api/proof/${loser.commitment}`, {
        method: 'GET'
      });

      expect(proofResponse.status).toBe(200);
      const proof = await proofResponse.json();
      expect(proof.found).toBe(false);

      console.log(`  [OK] ${loser.commitment.slice(0, 10)}... correctly has no proof`);
    }
  });

  it('[SINGLE] Should handle single winner scenario with correct root', async () => {
    const { app, mockBlockchainService } = testSetup;

    // Single winner (using existing market 2) with unique block numbers (4000-4001)
    const winner = {
      marketId: 2, commitment: '0x1111111111111111111111111111111111111111111111111111111111111111',
      amount: '1000000000000000000', outcome: true,
      betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa8', blockNumber: 4000
    };

    const loser = {
      marketId: 2, commitment: '0x4444444444444444444444444444444444444444444444444444444444444444',
      amount: '1500000000000000000', outcome: false,
      betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa9', blockNumber: 4001
    };

    // Store events
    const allBets = [winner, loser];
    for (const bet of allBets) {
      const mockEvent = createMockBetEvent(bet);
      const mockLog = (mockBlockchainService as any).createMockLog(mockEvent);

      const storedLogs = (mockBlockchainService as any).storedLogs;
      if (!storedLogs.has(bet.blockNumber)) {
        storedLogs.set(bet.blockNumber, []);
      }
      storedLogs.get(bet.blockNumber).push(mockLog);
    }

    // Refresh
    await app.request('/api/system/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromBlock: 4000, toBlock: 4001 })
    });

    // Resolve
    const resolveResponse = await app.request('/api/market/2/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winningOutcome: true })
    });

    console.log(`[DEBUG] Single winner resolve response status: ${resolveResponse.status}`);
    const resolution = await resolveResponse.json();
    console.log(`[DEBUG] Single winner resolution response:`, JSON.stringify(resolution, null, 2));
    expect(resolution.winnerCount).toBe(1);

    const expectedSingleRoot = '0xaa9b3542ed8e30a617d533c0621224e990920b6d6922db8a04f1b31a79b0afac';
    expect(resolution.root).toBe(expectedSingleRoot);

    console.log(`[OK] Single winner root verified: ${resolution.root}`);
  });

  it('[EMPTY] Should handle no winners scenario with empty root', async () => {
    const { app, mockBlockchainService } = testSetup;

    // Use market 1 (exists and is active) with unique block numbers (5000-5001) to avoid conflicts
    const losers = [
      {
        marketId: 1, commitment: '0x6666666666666666666666666666666666666666666666666666666666666666',
        amount: '1500000000000000000', outcome: false,
        betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa6', blockNumber: 5000
      },
      {
        marketId: 1, commitment: '0x7777777777777777777777777777777777777777777777777777777777777777',
        amount: '800000000000000000', outcome: false,
        betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa7', blockNumber: 5001
      }
    ];

    // Store events
    for (const bet of losers) {
      const mockEvent = createMockBetEvent(bet);
      const mockLog = (mockBlockchainService as any).createMockLog(mockEvent);

      const storedLogs = (mockBlockchainService as any).storedLogs;
      if (!storedLogs.has(bet.blockNumber)) {
        storedLogs.set(bet.blockNumber, []);
      }
      storedLogs.get(bet.blockNumber).push(mockLog);
    }

    // Refresh
    await app.request('/api/system/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromBlock: 5000, toBlock: 5001 })
    });

    // Resolve with Yes (no winners since all bet No)
    const resolveResponse = await app.request('/api/market/1/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winningOutcome: true })
    });

    console.log(`[DEBUG] Resolve response status: ${resolveResponse.status}`);
    const resolution = await resolveResponse.json();
    console.log(`[DEBUG] Resolution response:`, JSON.stringify(resolution, null, 2));
    expect(resolution.winnerCount).toBe(0);

    const expectedEmptyRoot = '0x0000000000000000000000000000000000000000000000000000000000000000';
    expect(resolution.root).toBe(expectedEmptyRoot);

    console.log(`[OK] No winners root verified: ${resolution.root}`);
  });
});