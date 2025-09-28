/**
 * @fileoverview Deterministic test data for Merkle tree verification
 * Pre-calculated roots and proofs for consistent E2E testing
 *
 * @module __tests__/utils/merkleTestData
 */

import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'viem';

/**
 * Creates a leaf hash exactly like MerkleTreeService does
 */
function createLeafHash(commitment: string, amount: string): string {
  const amountBigInt = BigInt(amount);
  const amountBytes = amountBigInt.toString(16).padStart(64, '0');
  const amountHex = '0x' + amountBytes;

  const packed = commitment + amountHex.slice(2); 

  const leafHash = keccak256(packed as `0x${string}`);

  return leafHash;
}

/**
 * Calculate Merkle root for given commitment-amount pairs
 */
function calculateMerkleRoot(commitmentAmountPairs: Array<[string, string]>): string {
  if (commitmentAmountPairs.length === 0) {
    return '0x' + '0'.repeat(64); 
  }

  const leaves = commitmentAmountPairs.map(([commitment, amount]) =>
    createLeafHash(commitment, amount)
  );

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return tree.getHexRoot();
}

/**
 * Deterministic test scenario: 3 Yes winners 
 */
export const SCENARIO_3_WINNERS = {
  marketId: 1,
  winningOutcome: true,
  winners: [
    {
      commitment: '0x1111111111111111111111111111111111111111111111111111111111111111',
      amount: '1000000000000000000', 
      outcome: true,
      betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
      blockNumber: 10000
    },
    {
      commitment: '0x2222222222222222222222222222222222222222222222222222222222222222',
      amount: '500000000000000000', 
      outcome: true,
      betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2',
      blockNumber: 10001
    },
    {
      commitment: '0x3333333333333333333333333333333333333333333333333333333333333333',
      amount: '2000000000000000000', 
      outcome: true,
      betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3',
      blockNumber: 10002
    }
  ],
  losers: [
    {
      commitment: '0x4444444444444444444444444444444444444444444444444444444444444444',
      amount: '1500000000000000000', 
      outcome: false,
      betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa4',
      blockNumber: 10003
    },
    {
      commitment: '0x5555555555555555555555555555555555555555555555555555555555555555',
      amount: '800000000000000000', 
      outcome: false,
      betId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5',
      blockNumber: 10004
    }
  ]
} as const;


const threeWinnersCommitmentPairs: Array<[string, string]> = [
  [SCENARIO_3_WINNERS.winners[0].commitment, SCENARIO_3_WINNERS.winners[0].amount],
  [SCENARIO_3_WINNERS.winners[1].commitment, SCENARIO_3_WINNERS.winners[1].amount],
  [SCENARIO_3_WINNERS.winners[2].commitment, SCENARIO_3_WINNERS.winners[2].amount]
];

export const EXPECTED_ROOTS = {
  threeWinners: calculateMerkleRoot(threeWinnersCommitmentPairs),
  singleWinner: calculateMerkleRoot([threeWinnersCommitmentPairs[0]]),
  noWinners: '0x0000000000000000000000000000000000000000000000000000000000000000'
} as const;

/**
 * Deterministic test scenario: 1 winner
 */
export const SCENARIO_1_WINNER = {
  marketId: 2,
  winningOutcome: true,
  winners: [SCENARIO_3_WINNERS.winners[0]], 
  losers: [SCENARIO_3_WINNERS.losers[0]] // Only first loser
} as const;

/**
 * Deterministic test scenario: No winners
 */
export const SCENARIO_NO_WINNERS = {
  marketId: 3,
  winningOutcome: true, 
  winners: [],
  losers: SCENARIO_3_WINNERS.losers // All bets were No
} as const;

/**
 * Deterministic test scenario: All winners
 */
export const SCENARIO_ALL_WINNERS = {
  marketId: 4,
  winningOutcome: true, 
  winners: SCENARIO_3_WINNERS.winners, 
  losers: []
} as const;

/**
 * Calculate expected root for all winners 
 */
export const EXPECTED_ALL_WINNERS_ROOT = calculateMerkleRoot(threeWinnersCommitmentPairs);

/**
 * Helper to get all bets (winners + losers) 
 */
export function getAllBets(scenario: typeof SCENARIO_3_WINNERS) {
  return [...scenario.winners, ...scenario.losers];
}

/**
 * Helper to create mock bet event data from bet
 */
export function createBetEventFromData(bet: typeof SCENARIO_3_WINNERS.winners[0], marketId?: number) {
  return {
    marketId: marketId ?? 1,
    commitment: bet.commitment,
    amount: bet.amount,
    outcome: bet.outcome,
    betId: bet.betId,
    blockNumber: bet.blockNumber
  };
}


console.log('[ROOTS] Pre-calculated Merkle roots:');
console.log('  3 Winners Root:', EXPECTED_ROOTS.threeWinners);
console.log('  1 Winner Root: ', EXPECTED_ROOTS.singleWinner);
console.log('  No Winners Root:', EXPECTED_ROOTS.noWinners);
console.log('  All Winners Root:', EXPECTED_ALL_WINNERS_ROOT);