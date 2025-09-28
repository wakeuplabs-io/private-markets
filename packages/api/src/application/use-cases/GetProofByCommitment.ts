/**
 * @fileoverview Get Proof by Commitment use case
 * Handles proof retrieval for commitment hashes in resolved markets
 *
 * @module application/use-cases/GetProofByCommitment
 */

import type { Logger } from 'pino';
import { IResolutionRepository } from '../../domain/repositories/IResolutionRepository';

/**
 * Response interface for proof retrieval
 */
export interface GetProofResponse {
  found: boolean;
  commitment?: string;
  amount?: string;
  proof?: string[];
  marketId?: number;
  outcome?: number;
  winningOutcome?: number;
  root?: string;
  leafIndex?: number;
}

/**
 * Custom error for proof retrieval failures
 */
export class ProofRetrievalError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly commitment?: string
  ) {
    super(message);
    this.name = 'ProofRetrievalError';
  }
}

/**
 * Use case for retrieving Merkle proofs by commitment
 */
export class GetProofByCommitment {
  constructor(
    private resolutionRepository: IResolutionRepository,
    private logger: Logger
  ) {}

  /**
   * Executes proof retrieval for a commitment
   */
  async execute(commitment: string): Promise<GetProofResponse> {
    this.logger.info({
      commitment: commitment.slice(0, 10) + '...'
    }, 'Retrieving proof for commitment');

    // Validate commitment format
    if (!this.isValidCommitment(commitment)) {
      throw new ProofRetrievalError(
        'Invalid commitment format. Must be 32-byte hex string with 0x prefix',
        'INVALID_COMMITMENT_FORMAT',
        commitment
      );
    }

    // Search for the commitment in all resolutions
    const proofResult = await this.resolutionRepository.getProof(commitment);

    if (!proofResult) {
      this.logger.info({
        commitment: commitment.slice(0, 10) + '...'
      }, 'Proof not found for commitment');

      return {
        found: false
      };
    }

    const { marketId, proof, resolution } = proofResult;

    this.logger.info({
      commitment: commitment.slice(0, 10) + '...',
      marketId,
      amount: proof.amount,
      proofLength: proof.proof.length,
      winningOutcome: resolution.winningOutcome,
      leafIndex: proof.leafIndex
    }, 'Proof found and retrieved successfully');

    return {
      found: true,
      commitment: proof.commitment,
      amount: proof.amount,
      proof: proof.proof,
      marketId,
      outcome: resolution.getWinningOutcomeNumber(),
      winningOutcome: resolution.getWinningOutcomeNumber(),
      root: resolution.root,
      leafIndex: proof.leafIndex
    };
  }

  /**
   * Checks if a commitment has a proof (lightweight check)
   */
  async hasProof(commitment: string): Promise<boolean> {
    this.logger.debug({
      commitment: commitment.slice(0, 10) + '...'
    }, 'Checking if proof exists for commitment');

    if (!this.isValidCommitment(commitment)) {
      return false;
    }

    const proofResult = await this.resolutionRepository.getProof(commitment);
    const hasProof = proofResult !== null;

    this.logger.debug({
      commitment: commitment.slice(0, 10) + '...',
      hasProof
    }, 'Proof existence check completed');

    return hasProof;
  }

  /**
   * Gets detailed proof information including market context
   */
  async getDetailedProof(commitment: string): Promise<GetProofResponse & {
    marketQuestion?: string;
    totalWinners?: string;
    totalPool?: string;
    resolvedAt?: string;
  }> {
    const basicProof = await this.execute(commitment);

    if (!basicProof.found || !basicProof.marketId) {
      return basicProof;
    }

    // Get additional market context if needed
    const proofResult = await this.resolutionRepository.getProof(commitment);
    if (!proofResult) {
      return basicProof;
    }

    const { resolution } = proofResult;

    return {
      ...basicProof,
      totalWinners: resolution.getTotalWinnersAmount(),
      totalPool: resolution.getTotalPoolAmount(),
      resolvedAt: resolution.resolvedAt.toISOString()
    };
  }

  /**
   * Validates commitment format
   */
  private isValidCommitment(commitment: string): boolean {
    // Must be hex string with 0x prefix, 32 bytes (66 chars total)
    const hexRegex = /^0x[a-fA-F0-9]{64}$/;
    return hexRegex.test(commitment);
  }

  /**
   * Gets proof statistics for monitoring
   */
  async getProofStats(): Promise<{
    totalProofs: number;
    totalResolutions: number;
    averageProofLength: number;
  }> {
    this.logger.debug('Calculating proof statistics');

    const stats = await this.resolutionRepository.getStats();

    // Calculate average proof length (most proofs will have similar length in binary trees)
    const averageProofLength = stats.totalProofs > 0 ?
      Math.ceil(Math.log2(stats.totalProofs)) : 0;

    const proofStats = {
      totalProofs: stats.totalProofs,
      totalResolutions: stats.totalResolutions,
      averageProofLength
    };

    this.logger.debug(proofStats, 'Proof statistics calculated');

    return proofStats;
  }
}