/**
 * @fileoverview In-memory implementation of Resolution repository
 * Provides storage for market resolution records with detailed logging
 *
 * @module infrastructure/persistence/InMemoryResolutionRepository
 */

import { MarketResolution } from '../../domain/entities/MarketResolution';
import { IResolutionRepository } from '../../domain/repositories/IResolutionRepository';
import type { MerkleProof } from '../../domain/services/IMerkleService';
import type { Logger } from 'pino';

export class InMemoryResolutionRepository implements IResolutionRepository {
  private resolutionsByMarketId: Map<number, MarketResolution> = new Map();

  constructor(private logger: Logger) {}

  async store(resolution: MarketResolution): Promise<void> {
    this.logger.info({
      marketId: resolution.marketId,
      winningOutcome: resolution.winningOutcome,
      root: resolution.root,
      winnerCount: resolution.winnerCount,
      totalWinners: resolution.getTotalWinnersAmount(),
      totalPool: resolution.getTotalPoolAmount()
    }, 'Storing market resolution');

    this.resolutionsByMarketId.set(resolution.marketId, resolution);

    this.logger.info({
      marketId: resolution.marketId,
      totalResolutions: this.resolutionsByMarketId.size,
      proofCount: resolution.proofs.size
    }, 'Market resolution stored successfully');
  }

  async findByMarketId(marketId: number): Promise<MarketResolution | null> {
    this.logger.debug({ marketId }, 'Finding resolution by market ID');

    const resolution = this.resolutionsByMarketId.get(marketId) || null;

    this.logger.debug({
      marketId,
      found: resolution !== null,
      winningOutcome: resolution?.winningOutcome,
      root: resolution?.root?.slice(0, 10) + '...'
    }, 'Market resolution lookup result');

    return resolution;
  }

  async findAll(): Promise<MarketResolution[]> {
    this.logger.debug('Finding all resolutions');

    const resolutions = Array.from(this.resolutionsByMarketId.values());

    this.logger.debug({
      resolutionCount: resolutions.length,
      marketIds: resolutions.map(r => r.marketId)
    }, 'All resolutions retrieved');

    return resolutions;
  }

  async isResolved(marketId: number): Promise<boolean> {
    const resolved = this.resolutionsByMarketId.has(marketId);

    this.logger.debug({
      marketId,
      resolved
    }, 'Market resolution status checked');

    return resolved;
  }

  async getProof(commitment: string): Promise<{
    marketId: number;
    proof: MerkleProof;
    resolution: MarketResolution;
  } | null> {
    this.logger.debug({
      commitment: commitment.slice(0, 10) + '...'
    }, 'Finding proof by commitment');

    // Search through all resolutions for the commitment
    for (const resolution of this.resolutionsByMarketId.values()) {
      const proof = resolution.getProof(commitment);
      if (proof) {
        this.logger.debug({
          commitment: commitment.slice(0, 10) + '...',
          marketId: resolution.marketId,
          amount: proof.amount,
          proofLength: proof.proof.length
        }, 'Proof found for commitment');

        return {
          marketId: resolution.marketId,
          proof,
          resolution
        };
      }
    }

    this.logger.debug({
      commitment: commitment.slice(0, 10) + '...'
    }, 'Proof not found for commitment');

    return null;
  }

  async findByCommitment(commitment: string): Promise<MarketResolution[]> {
    this.logger.debug({
      commitment: commitment.slice(0, 10) + '...'
    }, 'Finding resolutions by commitment');

    const matchingResolutions = Array.from(this.resolutionsByMarketId.values())
      .filter(resolution => resolution.isWinner(commitment));

    this.logger.debug({
      commitment: commitment.slice(0, 10) + '...',
      matchingCount: matchingResolutions.length,
      marketIds: matchingResolutions.map(r => r.marketId)
    }, 'Resolutions found for commitment');

    return matchingResolutions;
  }

  async getStats(): Promise<{
    totalResolutions: number;
    totalProofs: number;
    totalWinners: number;
    oldestResolution?: Date;
    newestResolution?: Date;
  }> {
    this.logger.debug('Calculating resolution statistics');

    const resolutions = Array.from(this.resolutionsByMarketId.values());
    const totalProofs = resolutions.reduce((sum, r) => sum + r.proofs.size, 0);
    const totalWinners = resolutions.reduce((sum, r) => sum + r.winnerCount, 0);

    const dates = resolutions.map(r => r.resolvedAt);
    const oldestResolution = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : undefined;
    const newestResolution = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined;

    const stats = {
      totalResolutions: resolutions.length,
      totalProofs,
      totalWinners,
      oldestResolution,
      newestResolution
    };

    this.logger.debug(stats, 'Resolution statistics calculated');

    return stats;
  }

  async delete(marketId: number): Promise<boolean> {
    this.logger.info({ marketId }, 'Deleting resolution');

    const existed = this.resolutionsByMarketId.has(marketId);
    this.resolutionsByMarketId.delete(marketId);

    this.logger.info({
      marketId,
      existed,
      totalResolutions: this.resolutionsByMarketId.size
    }, 'Resolution deletion completed');

    return existed;
  }

  async update(resolution: MarketResolution): Promise<void> {
    this.logger.info({
      marketId: resolution.marketId,
      winningOutcome: resolution.winningOutcome,
      newRoot: resolution.root,
      newWinnerCount: resolution.winnerCount
    }, 'Updating resolution');

    await this.store(resolution); // Store overwrites existing

    this.logger.info({
      marketId: resolution.marketId
    }, 'Resolution updated successfully');
  }

  async hasProof(commitment: string, amount: string): Promise<boolean> {
    this.logger.debug({
      commitment: commitment.slice(0, 10) + '...',
      amount
    }, 'Checking if proof exists');

    const proofResult = await this.getProof(commitment);
    const hasProof = proofResult !== null && proofResult.proof.amount === amount;

    this.logger.debug({
      commitment: commitment.slice(0, 10) + '...',
      amount,
      hasProof
    }, 'Proof existence check completed');

    return hasProof;
  }

  async getWinningCommitments(marketId: number): Promise<string[]> {
    this.logger.debug({ marketId }, 'Getting winning commitments for market');

    const resolution = await this.findByMarketId(marketId);
    const commitments = resolution ? resolution.getWinningCommitments() : [];

    this.logger.debug({
      marketId,
      commitmentCount: commitments.length,
      sampleCommitments: commitments.slice(0, 3).map(c => c.slice(0, 10) + '...')
    }, 'Winning commitments retrieved');

    return commitments;
  }

  async clear(): Promise<void> {
    const beforeCount = this.resolutionsByMarketId.size;

    this.resolutionsByMarketId.clear();

    this.logger.info({
      clearedCount: beforeCount
    }, 'Resolution repository cleared');
  }
}