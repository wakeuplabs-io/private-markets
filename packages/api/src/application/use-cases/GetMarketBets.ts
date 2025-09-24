/**
 * @fileoverview GetMarketBets use case
 * Handles the business logic for retrieving bets for a specific market
 *
 * @module application/use-cases/GetMarketBets
 */

import { BetRecord } from '../../domain/entities/BetRecord';
import { IBetRepository } from '../../domain/repositories/IBetRepository';
import type { Logger } from 'pino';

/**
 * Response structure for market bets
 */
export interface GetMarketBetsResponse {
  marketId: number;
  bets: Array<{
    commitment: string;
    amount: string;
    outcome: boolean;
    outcomeLabel: string;
    betId: string;
    blockNumber: number;
    timestamp: string;
  }>;
  totalBets: number;
  totalYes: number;
  totalNo: number;
  totalAmountYes: string;
  totalAmountNo: string;
}

/**
 * Use case for retrieving bets for a specific market
 */
export class GetMarketBets {
  constructor(
    private betRepository: IBetRepository,
    private logger: Logger
  ) {}

  /**
   * Executes the use case to get all bets for a market
   * @param marketId - The ID of the market to retrieve bets for
   * @returns Promise resolving to market bets response
   */
  async execute(marketId: number): Promise<GetMarketBetsResponse> {
    this.logger.info({ marketId }, 'Retrieving bets for market');

    // Validate input
    if (!Number.isInteger(marketId) || marketId <= 0) {
      this.logger.error({ marketId }, 'Invalid market ID provided');
      throw new Error('Market ID must be a positive integer');
    }

    // Retrieve bets from repository
    const bets = await this.betRepository.findByMarket(marketId);

    this.logger.info({
      marketId,
      betCount: bets.length
    }, 'Bets retrieved from repository');

    // Calculate statistics
    const stats = this.calculateBetStatistics(bets);

    this.logger.info({
      marketId,
      totalBets: stats.totalBets,
      totalYes: stats.totalYes,
      totalNo: stats.totalNo,
      totalAmountYes: stats.totalAmountYes,
      totalAmountNo: stats.totalAmountNo
    }, 'Calculated bet statistics');

    // Format response
    const response: GetMarketBetsResponse = {
      marketId,
      bets: bets.map(bet => ({
        commitment: bet.commitment,
        amount: bet.amount.toString(),
        outcome: bet.outcome,
        outcomeLabel: bet.getOutcomeLabel(),
        betId: bet.betId,
        blockNumber: bet.blockNumber,
        timestamp: bet.timestamp.toISOString()
      })),
      ...stats
    };

    this.logger.info({
      marketId,
      responseSize: response.bets.length
    }, 'Market bets response prepared');

    return response;
  }

  /**
   * Calculates statistics for a set of bets
   * @private
   */
  private calculateBetStatistics(bets: BetRecord[]) {
    let totalYes = 0;
    let totalNo = 0;
    let totalAmountYes = 0n;
    let totalAmountNo = 0n;

    for (const bet of bets) {
      if (bet.outcome) {
        totalYes++;
        totalAmountYes += BigInt(bet.amount);
      } else {
        totalNo++;
        totalAmountNo += BigInt(bet.amount);
      }
    }

    return {
      totalBets: bets.length,
      totalYes,
      totalNo,
      totalAmountYes: totalAmountYes.toString(),
      totalAmountNo: totalAmountNo.toString()
    };
  }

  /**
   * Formats bigint amount to decimal string
   * @private
   */
  private formatAmount(amount: bigint): string {
    const decimals = 18;
    const divisor = BigInt(10 ** decimals);
    const wholePart = amount / divisor;
    const fractionalPart = amount % divisor;

    if (fractionalPart === 0n) {
      return wholePart.toString();
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    return `${wholePart}.${fractionalStr.replace(/0+$/, '')}`;
  }

  /**
   * Gets bet count for a market without full data
   */
  async getBetCount(marketId: number): Promise<number> {
    this.logger.info({ marketId }, 'Getting bet count for market');

    if (!Number.isInteger(marketId) || marketId <= 0) {
      return 0;
    }

    const count = await this.betRepository.countByMarket(marketId);

    this.logger.info({ marketId, count }, 'Bet count retrieved');

    return count;
  }
}