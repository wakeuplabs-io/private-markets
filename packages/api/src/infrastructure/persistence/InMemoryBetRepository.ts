/**
 * @fileoverview In-memory implementation of Bet repository
 * Provides storage for bet records with detailed logging
 *
 * @module infrastructure/persistence/InMemoryBetRepository
 */

import { BetRecord } from '../../domain/entities/BetRecord';
import { IBetRepository } from '../../domain/repositories/IBetRepository';
import type { Logger } from 'pino';

export class InMemoryBetRepository implements IBetRepository {
  private betsByCommitment: Map<string, BetRecord> = new Map();
  private betsByMarket: Map<number, BetRecord[]> = new Map();

  constructor(private logger: Logger) {}

  async store(bet: BetRecord): Promise<void> {
    this.logger.info({
      marketId: bet.marketId,
      commitment: bet.commitment,
      amount: bet.amount.toString(),
      outcome: bet.outcome
    }, 'Storing bet record');

    // Store by commitment for quick lookup
    this.betsByCommitment.set(bet.commitment, bet);

    // Store by market for market-based queries
    if (!this.betsByMarket.has(bet.marketId)) {
      this.betsByMarket.set(bet.marketId, []);
    }
    this.betsByMarket.get(bet.marketId)!.push(bet);

    this.logger.info({
      marketId: bet.marketId,
      commitment: bet.commitment,
      totalBetsInMarket: this.betsByMarket.get(bet.marketId)!.length,
      totalBetsOverall: this.betsByCommitment.size
    }, 'Bet stored successfully');
  }

  async findByMarket(marketId: number): Promise<BetRecord[]> {
    this.logger.info({ marketId }, 'Finding bets for market');

    const bets = this.betsByMarket.get(marketId) || [];

    this.logger.info({
      marketId,
      betCount: bets.length
    }, 'Found bets for market');

    return bets;
  }

  async findByCommitment(commitment: string): Promise<BetRecord | null> {
    this.logger.info({ commitment }, 'Finding bet by commitment');

    const bet = this.betsByCommitment.get(commitment) || null;

    this.logger.info({
      commitment,
      found: bet !== null,
      marketId: bet?.marketId
    }, 'Commitment lookup result');

    return bet;
  }

  async findWinners(marketId: number, winningOutcome: boolean): Promise<BetRecord[]> {
    this.logger.info({ marketId, winningOutcome }, 'Finding winning bets');

    const allBets = await this.findByMarket(marketId);
    const winners = allBets.filter(bet => bet.isWinner(winningOutcome));

    this.logger.info({
      marketId,
      winningOutcome,
      totalBets: allBets.length,
      winnerCount: winners.length
    }, 'Winners found');

    return winners;
  }

  async countByMarket(marketId: number): Promise<number> {
    const bets = await this.findByMarket(marketId);
    const count = bets.length;

    this.logger.info({ marketId, count }, 'Counted bets for market');

    return count;
  }

  async exists(commitment: string): Promise<boolean> {
    const exists = this.betsByCommitment.has(commitment);

    this.logger.debug({ commitment, exists }, 'Checking bet existence');

    return exists;
  }

  /**
   * Get total number of stored bets (for debugging)
   */
  async getTotalCount(): Promise<number> {
    const count = this.betsByCommitment.size;

    this.logger.info({ totalBets: count }, 'Total bets in repository');

    return count;
  }

  /**
   * Get all markets with bets (for debugging)
   */
  async getMarketsWithBets(): Promise<number[]> {
    const markets = Array.from(this.betsByMarket.keys());

    this.logger.info({
      marketCount: markets.length,
      markets
    }, 'Markets with bets');

    return markets;
  }

  /**
   * Clear all bets (for testing)
   */
  async clear(): Promise<void> {
    const beforeCount = this.betsByCommitment.size;

    this.betsByCommitment.clear();
    this.betsByMarket.clear();

    this.logger.info({
      clearedCount: beforeCount
    }, 'Repository cleared');
  }
}