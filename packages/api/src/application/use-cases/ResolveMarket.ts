/**
 * @fileoverview Resolve Market use case
 * Handles market resolution with Merkle tree construction and proof generation
 *
 * @module application/use-cases/ResolveMarket
 */

import type { Logger } from 'pino';
import { IMarketRepository } from '../../domain/repositories/IMarketRepository';
import { IBetRepository } from '../../domain/repositories/IBetRepository';
import { IResolutionRepository } from '../../domain/repositories/IResolutionRepository';
import { IMerkleService } from '../../domain/services/IMerkleService';
import { MarketResolution } from '../../domain/entities/MarketResolution';

/**
 * Request interface for resolving a market
 */
export interface ResolveMarketRequest {
  marketId: number;
  winningOutcome: boolean;
  adminSignature?: string; // Optional for future admin validation
}

/**
 * Response interface for market resolution
 */
export interface ResolveMarketResponse {
  marketId: number;
  winningOutcome: number;
  winningOutcomeLabel: string;
  root: string;
  totalWinners: string;
  totalPool: string;
  winnerCount: number;
  resolvedAt: string;
  summary: {
    totalBets: number;
    totalYesBets: number;
    totalNoBets: number;
    winningBetCount: number;
    losingBetCount: number;
  };
}

/**
 * Custom error for market resolution failures
 */
export class MarketResolutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly marketId?: number
  ) {
    super(message);
    this.name = 'MarketResolutionError';
  }
}

/**
 * Use case for resolving prediction markets with Merkle tree construction
 */
export class ResolveMarket {
  constructor(
    private marketRepository: IMarketRepository,
    private betRepository: IBetRepository,
    private resolutionRepository: IResolutionRepository,
    private merkleService: IMerkleService,
    private logger: Logger
  ) {}

  /**
   * Executes market resolution
   */
  async execute(request: ResolveMarketRequest): Promise<ResolveMarketResponse> {
    this.logger.info({
      marketId: request.marketId,
      winningOutcome: request.winningOutcome,
      hasAdminSignature: !!request.adminSignature
    }, 'Starting market resolution');

    // Validate market exists
    const market = await this.marketRepository.findById(request.marketId);
    if (!market) {
      throw new MarketResolutionError(
        `Market ${request.marketId} not found`,
        'MARKET_NOT_FOUND',
        request.marketId
      );
    }

    // Check if market is active
    if (!market.isActive()) {
      throw new MarketResolutionError(
        `Market ${request.marketId} is not active (status: ${market.status})`,
        'MARKET_NOT_ACTIVE',
        request.marketId
      );
    }

    // Check if already resolved
    const existingResolution = await this.resolutionRepository.findByMarketId(request.marketId);
    if (existingResolution) {
      this.logger.warn({
        marketId: request.marketId,
        existingWinningOutcome: existingResolution.winningOutcome
      }, 'Market already resolved');

      return this.buildResponse(existingResolution);
    }

    // Get all bets for this market
    const allBets = await this.betRepository.findByMarket(request.marketId);

    this.logger.info({
      marketId: request.marketId,
      totalBets: allBets.length
    }, 'Retrieved bets for market resolution');

    if (allBets.length === 0) {
      throw new MarketResolutionError(
        `No bets found for market ${request.marketId}`,
        'NO_BETS_FOUND',
        request.marketId
      );
    }

    // Filter winning bets
    const winningBets = allBets.filter(bet => bet.outcome === request.winningOutcome);

    if (winningBets.length === 0) {
      this.logger.warn({
        marketId: request.marketId,
        winningOutcome: request.winningOutcome,
        totalBets: allBets.length
      }, 'No winning bets found for market');

      // Still create resolution with empty tree for consistency
      // This allows the contract to be properly resolved even with no winners
    }

    this.logger.info({
      marketId: request.marketId,
      totalBets: allBets.length,
      winningBets: winningBets.length,
      losingBets: allBets.length - winningBets.length,
      winningOutcome: request.winningOutcome
    }, 'Filtered bets by winning outcome');

    // Calculate totals
    const totalPool = allBets.reduce((sum, bet) => sum + BigInt(bet.amount), BigInt(0));
    const totalWinners = winningBets.reduce((sum, bet) => sum + BigInt(bet.amount), BigInt(0));

    // Build Merkle tree if there are winners
    let merkleResult;
    if (winningBets.length > 0) {
      const commitmentAmountPairs: Array<[string, string]> = winningBets.map(bet => [
        bet.commitment,
        bet.amount.toString()
      ]);

      this.logger.info({
        marketId: request.marketId,
        pairsCount: commitmentAmountPairs.length,
        samplePairs: commitmentAmountPairs.slice(0, 3).map(([commitment, amount]) => ({
          commitment: commitment.slice(0, 10) + '...',
          amount
        }))
      }, 'Building Merkle tree for winning bets');

      merkleResult = await this.merkleService.buildTree(commitmentAmountPairs);

      this.logger.info({
        marketId: request.marketId,
        root: merkleResult.root,
        proofCount: merkleResult.proofs.size,
        leafCount: merkleResult.leafCount
      }, 'Merkle tree constructed successfully');
    } else {
      // Create empty tree structure for no winners scenario
      merkleResult = {
        root: '0x' + '0'.repeat(64), // Empty root
        proofs: new Map(),
        leafCount: 0
      };

      this.logger.info({
        marketId: request.marketId,
        root: merkleResult.root
      }, 'Created empty resolution for market with no winners');
    }

    // Create and store resolution
    const resolution = MarketResolution.create(
      request.marketId,
      request.winningOutcome,
      merkleResult.root,
      totalWinners,
      totalPool,
      merkleResult.proofs
    );

    await this.resolutionRepository.store(resolution);

    this.logger.info({
      marketId: request.marketId,
      root: resolution.root,
      totalWinners: resolution.getTotalWinnersAmount(),
      totalPool: resolution.getTotalPoolAmount(),
      winnerCount: resolution.winnerCount
    }, 'Market resolution completed and stored');

    return this.buildResponse(resolution);
  }

  /**
   * Builds the response object from a resolution
   */
  private buildResponse(resolution: MarketResolution): ResolveMarketResponse {
    return {
      marketId: resolution.marketId,
      winningOutcome: resolution.getWinningOutcomeNumber(),
      winningOutcomeLabel: resolution.getWinningOutcomeLabel(),
      root: resolution.root,
      totalWinners: resolution.getTotalWinnersAmount(),
      totalPool: resolution.getTotalPoolAmount(),
      winnerCount: resolution.winnerCount,
      resolvedAt: resolution.resolvedAt.toISOString(),
      summary: {
        totalBets: 0, // Will be calculated if needed
        totalYesBets: 0, // Will be calculated if needed
        totalNoBets: 0, // Will be calculated if needed
        winningBetCount: resolution.winnerCount,
        losingBetCount: 0 // Will be calculated if needed
      }
    };
  }

  /**
   * Validates winning outcome value
   */
  private validateWinningOutcome(winningOutcome: boolean): void {
    // In binary prediction markets, outcomes are boolean (true = Yes, false = No)
    // This validation ensures the outcome is properly boolean
    if (typeof winningOutcome !== 'boolean') {
      throw new MarketResolutionError(
        'Winning outcome must be boolean (true for Yes, false for No)',
        'INVALID_WINNING_OUTCOME'
      );
    }
  }

  /**
   * Gets resolution status for a market
   */
  async getResolutionStatus(marketId: number): Promise<{
    resolved: boolean;
    resolution?: MarketResolution;
  }> {
    const resolution = await this.resolutionRepository.findByMarketId(marketId);

    return {
      resolved: resolution !== null,
      resolution: resolution || undefined
    };
  }
}