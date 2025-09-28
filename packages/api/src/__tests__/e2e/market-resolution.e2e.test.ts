/**
 * @fileoverview E2E tests for market resolution and Merkle tree functionality
 * Tests the complete flow from bets → resolution → proof distribution
 *
 * @module __tests__/e2e/market-resolution.e2e.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestApp,
  validateBetResponseStructure,
  assertBigIntString,
  type TestAppSetup
} from '../utils/testHelpers';
import {
  createMockBetEvent,
  type MockEventData
} from '../mocks/mockEventData';

/**
 * Test data for market resolution scenarios
 */
const resolutionTestData = {
  winners: [
    {
      commitment: '0x1111111111111111111111111111111111111111111111111111111111111111',
      amount: '1000000000000000000', // 1 ETH
      outcome: true,
      betId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1'
    },
    {
      commitment: '0x2222222222222222222222222222222222222222222222222222222222222222',
      amount: '500000000000000000', // 0.5 ETH
      outcome: true,
      betId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2'
    },
    {
      commitment: '0x3333333333333333333333333333333333333333333333333333333333333333',
      amount: '2000000000000000000', // 2 ETH
      outcome: true,
      betId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb3'
    }
  ],
  losers: [
    {
      commitment: '0x4444444444444444444444444444444444444444444444444444444444444444',
      amount: '1500000000000000000', // 1.5 ETH
      outcome: false,
      betId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb4'
    },
    {
      commitment: '0x5555555555555555555555555555555555555555555555555555555555555555',
      amount: '800000000000000000', // 0.8 ETH
      outcome: false,
      betId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb5'
    }
  ]
};

describe('E2E: Market Resolution & Merkle Trees', () => {
  let testSetup: TestAppSetup;

  beforeEach(async () => {
    // Create fresh test app for each test
    testSetup = createTestApp();

    // Start the mock blockchain service
    await testSetup.mockBlockchainService.startListening();
  });

  /**
   * Helper function to setup market with bets
   */
  async function setupMarketWithBets(winners: any[], losers: any[], marketId: number = 1) {
    const allBets = [...winners, ...losers];

    // Trigger mock events for all bets
    for (const bet of allBets) {
      const mockEvent = createMockBetEvent({
        marketId,
        commitment: bet.commitment,
        amount: bet.amount,
        outcome: bet.outcome,
        betId: bet.betId,
        blockNumber: 12345 + allBets.indexOf(bet)
      });

      await testSetup.mockBlockchainService.triggerBetReceivedEvent(mockEvent);
    }

    console.log(`[OK] Setup complete: ${allBets.length} bets created for market ${marketId}`);
    return allBets;
  }

  /**
   * Helper function to validate Merkle proof structure
   */
  function validateMerkleProofStructure(proof: any) {
    expect(proof).toHaveProperty('found');
    if (proof.found) {
      expect(proof).toHaveProperty('commitment');
      expect(proof).toHaveProperty('amount');
      expect(proof).toHaveProperty('proof');
      expect(proof).toHaveProperty('marketId');
      expect(proof).toHaveProperty('outcome');
      expect(proof).toHaveProperty('root');
      expect(proof).toHaveProperty('leafIndex');

      expect(Array.isArray(proof.proof)).toBe(true);
      expect(typeof proof.commitment).toBe('string');
      expect(typeof proof.amount).toBe('string');
      expect(typeof proof.marketId).toBe('number');
      expect(typeof proof.outcome).toBe('number');
      expect(typeof proof.root).toBe('string');
      expect(typeof proof.leafIndex).toBe('number');
    }
  }

  describe('Basic Market Resolution Flow', () => {
    it('[CORE] Should resolve market with 5 bets (3 Yes winners, 2 No losers) and create Merkle tree', async () => {
      const { app } = testSetup;

      // Setup: Create 5 bets (3 Yes, 2 No)
      await setupMarketWithBets(resolutionTestData.winners, resolutionTestData.losers);

      // Action: Resolve market with "Yes" as winning outcome
      const resolveResponse = await app.request('/api/market/1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningOutcome: true })
      });

      expect(resolveResponse.status).toBe(200);
      const resolution = await resolveResponse.json();

      // Assertions: Validate resolution structure and data
      expect(resolution.marketId).toBe(1);
      expect(resolution.winningOutcome).toBe(1); // true = 1
      expect(resolution.winningOutcomeLabel).toBe('Yes');
      expect(resolution.root).toMatch(/^0x[a-fA-F0-9]{64}$/); // Valid hex root
      expect(resolution.root).not.toBe('0x' + '0'.repeat(64)); // Not empty root

      // Validate amounts
      assertBigIntString(resolution.totalWinners, '3500000000000000000'); // 1 + 0.5 + 2 = 3.5 ETH
      assertBigIntString(resolution.totalPool, '5800000000000000000'); // 3.5 + 1.5 + 0.8 = 5.8 ETH
      expect(resolution.winnerCount).toBe(3);

      // Validate timestamp
      expect(resolution.resolvedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      console.log(`[OK] Market resolved with root: ${resolution.root.slice(0, 10)}...`);
      console.log(`[OK] Winners: ${resolution.winnerCount}, Total pool: ${resolution.totalPool} wei`);
    });
  });

  describe('Proof Distribution & Verification', () => {
    it('Winners should get valid Merkle proofs', async () => {
      const { app } = testSetup;

      // Setup market and resolve
      await setupMarketWithBets(resolutionTestData.winners, resolutionTestData.losers);

      const resolveResponse = await app.request('/api/market/1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningOutcome: true })
      });

      const resolution = await resolveResponse.json();
      const expectedRoot = resolution.root;

      // Test each winner's proof
      for (const winner of resolutionTestData.winners) {
        const proofResponse = await app.request(`/api/proof/${winner.commitment}`, {
          method: 'GET'
        });

        expect(proofResponse.status).toBe(200);
        const proof = await proofResponse.json();

        // Validate proof structure
        validateMerkleProofStructure(proof);

        // Validate proof content
        expect(proof.found).toBe(true);
        expect(proof.commitment).toBe(winner.commitment);
        expect(proof.amount).toBe(winner.amount);
        expect(proof.marketId).toBe(1);
        expect(proof.outcome).toBe(1); // Yes = 1
        expect(proof.root).toBe(expectedRoot);

        // Verify proof array has reasonable length (log2(3) ≈ 2)
        expect(proof.proof.length).toBeGreaterThanOrEqual(1);
        expect(proof.proof.length).toBeLessThanOrEqual(3);

        // Validate proof elements are hex strings
        proof.proof.forEach((hash: string) => {
          expect(hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        });

        console.log(`[OK] Winner ${winner.commitment.slice(0, 10)}... has valid proof (${proof.proof.length} siblings)`);
      }
    });

    it('Losers should not have proofs', async () => {
      const { app } = testSetup;

      // Setup market and resolve
      await setupMarketWithBets(resolutionTestData.winners, resolutionTestData.losers);

      await app.request('/api/market/1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningOutcome: true })
      });

      // Test each loser's proof
      for (const loser of resolutionTestData.losers) {
        const proofResponse = await app.request(`/api/proof/${loser.commitment}`, {
          method: 'GET'
        });

        expect(proofResponse.status).toBe(200);
        const proof = await proofResponse.json();

        // Validate proof structure for non-found case
        expect(proof.found).toBe(false);
        expect(proof.commitment).toBeUndefined();
        expect(proof.amount).toBeUndefined();
        expect(proof.proof).toBeUndefined();

        console.log(`[OK] Loser ${loser.commitment.slice(0, 10)}... correctly has no proof`);
      }
    });
  });

  describe('Market Status Integration', () => {
    it('Status should reflect resolution state', async () => {
      const { app } = testSetup;

      // Setup market and resolve
      await setupMarketWithBets(resolutionTestData.winners, resolutionTestData.losers);

      const resolveResponse = await app.request('/api/market/1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningOutcome: true })
      });

      const resolution = await resolveResponse.json();

      // Get market status
      const statusResponse = await app.request('/api/market/1/status', {
        method: 'GET'
      });

      expect(statusResponse.status).toBe(200);
      const status = await statusResponse.json();

      // Validate status reflects resolution
      expect(status.marketId).toBe(1);
      expect(status.resolved).toBe(true);
      expect(status.winningOutcome).toBe(1);
      expect(status.winningOutcomeLabel).toBe('Yes');
      expect(status.root).toBe(resolution.root);
      expect(status.winnersCount).toBe(3);
      expect(status.betsCount).toBe(5);

      // Validate betting totals
      assertBigIntString(status.totalBets.yes, '3500000000000000000'); // Winners total
      assertBigIntString(status.totalBets.no, '2300000000000000000'); // Losers total

      // Validate timestamp
      expect(status.resolvedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      console.log(`[OK] Market status correctly reflects resolution: ${status.resolved ? 'RESOLVED' : 'PENDING'}`);
    });
  });

  describe('Edge Cases', () => {
    it('Should handle all winners scenario', async () => {
      const { app } = testSetup;

      // Setup: 3 bets, all "Yes"
      const allWinners = resolutionTestData.winners;
      await setupMarketWithBets(allWinners, []);

      // Resolve with "Yes"
      const resolveResponse = await app.request('/api/market/1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningOutcome: true })
      });

      expect(resolveResponse.status).toBe(200);
      const resolution = await resolveResponse.json();

      expect(resolution.winnerCount).toBe(3);
      assertBigIntString(resolution.totalWinners, '3500000000000000000');
      assertBigIntString(resolution.totalPool, '3500000000000000000'); // Same as totalWinners

      console.log(`[OK] All winners scenario: ${resolution.winnerCount} winners, pool = winners amount`);
    });

    it('Should handle no winners scenario', async () => {
      const { app } = testSetup;

      // Setup: 2 bets, all "No"
      const allLosers = resolutionTestData.losers;
      await setupMarketWithBets([], allLosers);

      // Resolve with "Yes" (no winners)
      const resolveResponse = await app.request('/api/market/1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningOutcome: true })
      });

      expect(resolveResponse.status).toBe(200);
      const resolution = await resolveResponse.json();

      expect(resolution.winnerCount).toBe(0);
      assertBigIntString(resolution.totalWinners, '0');
      assertBigIntString(resolution.totalPool, '2300000000000000000'); // Only losers' bets
      expect(resolution.root).toBe('0x' + '0'.repeat(64)); // Empty root

      console.log(`[OK] No winners scenario: empty root ${resolution.root}`);
    });

    it('Should handle single winner scenario', async () => {
      const { app } = testSetup;

      // Setup: 1 winner + 1 loser
      await setupMarketWithBets([resolutionTestData.winners[0]], [resolutionTestData.losers[0]]);

      // Resolve with "Yes"
      const resolveResponse = await app.request('/api/market/1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningOutcome: true })
      });

      expect(resolveResponse.status).toBe(200);
      const resolution = await resolveResponse.json();

      expect(resolution.winnerCount).toBe(1);
      assertBigIntString(resolution.totalWinners, '1000000000000000000'); // 1 ETH
      expect(resolution.root).not.toBe('0x' + '0'.repeat(64)); // Valid root for 1 leaf

      // Test single winner's proof
      const proofResponse = await app.request(`/api/proof/${resolutionTestData.winners[0].commitment}`, {
        method: 'GET'
      });

      const proof = await proofResponse.json();
      expect(proof.found).toBe(true);
      expect(proof.proof.length).toBeGreaterThanOrEqual(0); // Single leaf tree might have 0-1 siblings

      console.log(`[OK] Single winner scenario: proof length = ${proof.proof.length}`);
    });
  });

  describe('Error Handling', () => {
    it('Should prevent double resolution', async () => {
      const { app } = testSetup;

      // Setup and resolve once
      await setupMarketWithBets(resolutionTestData.winners, resolutionTestData.losers);

      const firstResolve = await app.request('/api/market/1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningOutcome: true })
      });

      expect(firstResolve.status).toBe(200);
      const firstResolution = await firstResolve.json();

      // Attempt second resolution
      const secondResolve = await app.request('/api/market/1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningOutcome: false }) // Different outcome
      });

      expect(secondResolve.status).toBe(200); // Should return existing resolution
      const secondResolution = await secondResolve.json();

      // Should return same resolution data
      expect(secondResolution.root).toBe(firstResolution.root);
      expect(secondResolution.winningOutcome).toBe(firstResolution.winningOutcome);
      expect(secondResolution.resolvedAt).toBe(firstResolution.resolvedAt);

      console.log(`[OK] Double resolution prevented: same root returned`);
    });

    it('Should handle resolution of non-existent market', async () => {
      const { app } = testSetup;

      const response = await app.request('/api/market/9999/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningOutcome: true })
      });

      expect(response.status).toBe(404);
      const error = await response.json();
      expect(error.message).toContain('Market 9999 not found');

      console.log(`[OK] Non-existent market resolution correctly returns 404`);
    });

    it('Should handle resolution of market with no bets', async () => {
      const { app } = testSetup;

      // Don't setup any bets, just try to resolve
      const response = await app.request('/api/market/1/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningOutcome: true })
      });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.message).toContain('No bets found for market 1');

      console.log(`[OK] Market with no bets correctly returns 400`);
    });
  });
});