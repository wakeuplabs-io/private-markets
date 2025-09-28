/**
 * @fileoverview Get Market Status use case
 * Handles retrieval of market status including resolution data and betting totals
 *
 * @module application/use-cases/GetMarketStatus
 */

import type { Logger } from 'pino';
import { IMarketRepository } from '../../domain/repositories/IMarketRepository';
import { IBetRepository } from '../../domain/repositories/IBetRepository';
import { IResolutionRepository } from '../../domain/repositories/IResolutionRepository';

/**
 * Response interface for market status
 */
export interface GetMarketStatusResponse {
  marketId: number;
  resolved: boolean;
  winningOutcome?: number;
  winningOutcomeLabel?: string;
  root?: string;
  totalBets: {
    yes: string;
    no: string;
  };
  winnersCount?: number;
  betsCount: number;
  resolvedAt?: string;
}

/**
 * Use case for retrieving comprehensive market status
 */
export class GetMarketStatus {
  constructor(
    private marketRepository: IMarketRepository,
    private betRepository: IBetRepository,
    private resolutionRepository: IResolutionRepository,
    private logger: Logger
  ) {}

  /**
   * Executes market status retrieval
   */
  async execute(marketId: number): Promise<GetMarketStatusResponse> {
    this.logger.info({ marketId }, 'Retrieving market status');

    // Validate market exists
    const market = await this.marketRepository.findById(marketId);
    if (!market) {
      throw new Error(`Market ${marketId} not found`);
    }

    // Get all bets for the market
    const bets = await this.betRepository.findByMarket(marketId);

    // Calculate betting totals
    let totalYes = BigInt(0);
    let totalNo = BigInt(0);

    bets.forEach(bet => {
      if (bet.outcome) {
        totalYes += BigInt(bet.amount);
      } else {
        totalNo += BigInt(bet.amount);
      }
    });

    // Check if market is resolved
    const resolution = await this.resolutionRepository.findByMarketId(marketId);

    this.logger.info({
      marketId,
      betsCount: bets.length,
      totalYes: totalYes.toString(),
      totalNo: totalNo.toString(),
      resolved: resolution !== null,
      winningOutcome: resolution?.winningOutcome
    }, 'Market status calculated');

    const response: GetMarketStatusResponse = {
      marketId,
      resolved: resolution !== null,
      totalBets: {
        yes: totalYes.toString(),
        no: totalNo.toString()
      },
      betsCount: bets.length
    };

    // Add resolution data if available
    if (resolution) {
      response.winningOutcome = resolution.getWinningOutcomeNumber();
      response.winningOutcomeLabel = resolution.getWinningOutcomeLabel();
      response.root = resolution.root;
      response.winnersCount = resolution.winnerCount;
      response.resolvedAt = resolution.resolvedAt.toISOString();
    }

    this.logger.info({
      marketId,
      response: {
        resolved: response.resolved,
        betsCount: response.betsCount,
        winningOutcome: response.winningOutcome
      }
    }, 'Market status response prepared');

    return response;
  }

  /**
   * Quick check if market is resolved
   */
  async isMarketResolved(marketId: number): Promise<boolean> {
    this.logger.debug({ marketId }, 'Checking if market is resolved');

    const isResolved = await this.resolutionRepository.isResolved(marketId);

    this.logger.debug({
      marketId,
      isResolved
    }, 'Market resolution status checked');

    return isResolved;
  }

  /**
   * Gets basic betting statistics for a market
   */
  async getBettingStats(marketId: number): Promise<{
    totalBets: number;
    totalAmount: string;
    yesAmount: string;
    noAmount: string;
    yesPercentage: number;
    noPercentage: number;
  }> {
    this.logger.debug({ marketId }, 'Calculating betting statistics');

    const bets = await this.betRepository.findByMarket(marketId);

    let totalYes = BigInt(0);
    let totalNo = BigInt(0);

    bets.forEach(bet => {
      if (bet.outcome) {
        totalYes += BigInt(bet.amount);
      } else {
        totalNo += BigInt(bet.amount);
      }
    });

    const totalAmount = totalYes + totalNo;
    const yesPercentage = totalAmount > 0n ? Number((totalYes * BigInt(10000) / totalAmount)) / 100 : 0;
    const noPercentage = totalAmount > 0n ? Number((totalNo * BigInt(10000) / totalAmount)) / 100 : 0;

    const stats = {
      totalBets: bets.length,
      totalAmount: totalAmount.toString(),
      yesAmount: totalYes.toString(),
      noAmount: totalNo.toString(),
      yesPercentage,
      noPercentage
    };

    this.logger.debug({
      marketId,
      ...stats
    }, 'Betting statistics calculated');

    return stats;
  }
}