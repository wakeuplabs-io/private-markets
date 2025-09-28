/**
 * @fileoverview Market Resolution domain entity
 * Represents a resolved prediction market with Merkle tree data for claiming
 *
 * @module domain/entities/MarketResolution
 */

import type { MerkleProof } from '../services/IMerkleService';

/**
 * Market Resolution entity
 * Contains all data needed for a resolved market including Merkle tree proofs
 */
export class MarketResolution {
  constructor(
    public readonly marketId: number,
    public readonly winningOutcome: boolean,
    public readonly root: string,
    public readonly totalWinners: bigint,
    public readonly totalPool: bigint,
    public readonly resolvedAt: Date,
    public readonly proofs: Map<string, MerkleProof>,
    public readonly winnerCount: number
  ) {
    // Validation
    if (marketId <= 0) {
      throw new Error('Market ID must be positive');
    }

    if (!root || !root.startsWith('0x') || root.length !== 66) {
      throw new Error('Invalid Merkle root format');
    }

    if (totalWinners < 0n) {
      throw new Error('Total winners amount cannot be negative');
    }

    if (totalPool <= 0n) {
      throw new Error('Total pool amount must be positive');
    }

    if (winnerCount !== proofs.size) {
      throw new Error('Winner count must match proofs size');
    }
  }

  /**
   * Gets a proof for a specific commitment
   */
  getProof(commitment: string): MerkleProof | null {
    return this.proofs.get(commitment) || null;
  }

  /**
   * Checks if a commitment is a winner
   */
  isWinner(commitment: string): boolean {
    return this.proofs.has(commitment);
  }

  /**
   * Gets the winning outcome as a number (0 or 1)
   */
  getWinningOutcomeNumber(): number {
    return this.winningOutcome ? 1 : 0;
  }

  /**
   * Gets the winning outcome as a label
   */
  getWinningOutcomeLabel(): string {
    return this.winningOutcome ? 'Yes' : 'No';
  }

  /**
   * Gets all winning commitments
   */
  getWinningCommitments(): string[] {
    return Array.from(this.proofs.keys());
  }

  /**
   * Gets the total amount bet by winners
   */
  getTotalWinnersAmount(): string {
    return this.totalWinners.toString();
  }

  /**
   * Gets the total pool amount
   */
  getTotalPoolAmount(): string {
    return this.totalPool.toString();
  }

  /**
   * Gets the resolution age in hours
   */
  getResolutionAgeHours(): number {
    const now = new Date();
    const diffInMs = now.getTime() - this.resolvedAt.getTime();
    return Math.floor(diffInMs / (1000 * 60 * 60));
  }

  /**
   * Creates a summary object for API responses
   */
  toSummary() {
    return {
      marketId: this.marketId,
      winningOutcome: this.getWinningOutcomeNumber(),
      winningOutcomeLabel: this.getWinningOutcomeLabel(),
      root: this.root,
      totalWinners: this.getTotalWinnersAmount(),
      totalPool: this.getTotalPoolAmount(),
      winnerCount: this.winnerCount,
      resolvedAt: this.resolvedAt.toISOString(),
      resolutionAgeHours: this.getResolutionAgeHours()
    };
  }

  /**
   * Creates a detailed object for API responses including all proofs
   */
  toDetailed() {
    return {
      ...this.toSummary(),
      proofs: Array.from(this.proofs.entries()).map(([commitment, proof]) => ({
        commitment,
        amount: proof.amount,
        proof: proof.proof,
        leafIndex: proof.leafIndex
      }))
    };
  }

  /**
   * Factory method to create a MarketResolution from Merkle tree result
   */
  static create(
    marketId: number,
    winningOutcome: boolean,
    root: string,
    totalWinners: bigint,
    totalPool: bigint,
    proofs: Map<string, MerkleProof>,
    resolvedAt: Date = new Date()
  ): MarketResolution {
    return new MarketResolution(
      marketId,
      winningOutcome,
      root,
      totalWinners,
      totalPool,
      resolvedAt,
      proofs,
      proofs.size
    );
  }

  /**
   * Validates that a proof belongs to this resolution
   */
  validateProof(commitment: string, amount: string, proof: string[]): boolean {
    const storedProof = this.getProof(commitment);
    if (!storedProof) {
      return false;
    }

    return storedProof.amount === amount &&
           JSON.stringify(storedProof.proof) === JSON.stringify(proof);
  }
}