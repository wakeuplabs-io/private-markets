/**
 * @fileoverview StoreBet use case
 * Handles the business logic for storing bet records from blockchain events
 *
 * @module application/use-cases/StoreBet
 */

import { BetRecord } from '../../domain/entities/BetRecord';
import { IBetRepository } from '../../domain/repositories/IBetRepository';
import { BlockchainEventDTO } from '../dto/BlockchainEventDTO';
import type { Logger } from 'pino';

/**
 * Error thrown when bet data is invalid
 */
export class InvalidBetDataError extends Error {
  constructor(reason: string, data: Partial<BlockchainEventDTO>) {
    super(`Invalid bet data: ${reason}`);
    this.name = 'InvalidBetDataError';

    // Add data context for debugging
    Object.assign(this, { data });
  }
}

/**
 * Error thrown when bet already exists (duplicate processing)
 */
export class DuplicateBetError extends Error {
  constructor(commitment: string) {
    super(`Bet with commitment ${commitment} already exists`);
    this.name = 'DuplicateBetError';
  }
}

/**
 * Use case for storing bet records from blockchain events
 */
export class StoreBet {
  constructor(
    private betRepository: IBetRepository,
    private logger: Logger
  ) {}

  /**
   * Executes the use case to store a bet from blockchain event data
   * @param eventData - The blockchain event data
   * @throws InvalidBetDataError if the data is invalid
   * @throws DuplicateBetError if the bet already exists
   */
  async execute(eventData: BlockchainEventDTO): Promise<void> {
    this.logger.info({
      marketId: eventData.marketId,
      commitment: eventData.commitment,
      amount: eventData.amount.toString(),
      outcome: eventData.outcome,
      blockNumber: eventData.blockNumber
    }, 'Processing bet storage request');

    // Validate event data
    this.validateEventData(eventData);

    // Check for duplicate
    const existingBet = await this.betRepository.findByCommitment(eventData.commitment);
    if (existingBet) {
      this.logger.warn({
        commitment: eventData.commitment,
        marketId: eventData.marketId,
        existingMarketId: existingBet.marketId
      }, 'Duplicate bet detected, skipping storage');

      throw new DuplicateBetError(eventData.commitment);
    }

    // Create bet record from event data
    const bet = BetRecord.fromBlockchainEvent(
      eventData.marketId,
      eventData.betId,
      eventData.outcome,
      eventData.amount,
      eventData.commitment,
      eventData.blockNumber
    );

    this.logger.info({
      marketId: bet.marketId,
      commitment: bet.commitment,
      amount: bet.amount.toString(),
      outcome: bet.outcome,
      outcomeLabel: bet.getOutcomeLabel(),
      amountDecimal: bet.getAmountAsDecimal(),
      valid: bet.isValid()
    }, 'Created bet record from event');

    // Store the bet
    await this.betRepository.store(bet);

    this.logger.info({
      marketId: eventData.marketId,
      commitment: eventData.commitment,
      stored: true,
      transactionHash: eventData.transactionHash
    }, 'Bet stored successfully');
  }

  /**
   * Validates blockchain event data
   * @private
   */
  private validateEventData(eventData: BlockchainEventDTO): void {
    const errors: string[] = [];

    if (eventData.marketId <= 0) {
      errors.push('marketId must be positive');
    }

    if (!eventData.betId || eventData.betId.length === 0) {
      errors.push('betId cannot be empty');
    }

    if (eventData.amount <= 0n) {
      errors.push('amount must be positive');
    }

    if (!eventData.commitment || eventData.commitment.length === 0) {
      errors.push('commitment cannot be empty');
    }

    if (eventData.blockNumber <= 0) {
      errors.push('blockNumber must be positive');
    }

    if (!eventData.transactionHash || eventData.transactionHash.length === 0) {
      errors.push('transactionHash cannot be empty');
    }

    if (errors.length > 0) {
      this.logger.error({
        errors,
        eventData: {
          marketId: eventData.marketId,
          commitment: eventData.commitment,
          amount: eventData.amount.toString(),
          blockNumber: eventData.blockNumber
        }
      }, 'Invalid bet event data');

      throw new InvalidBetDataError(errors.join(', '), eventData);
    }

    this.logger.debug({
      marketId: eventData.marketId,
      commitment: eventData.commitment
    }, 'Event data validation passed');
  }

  /**
   * Checks if a bet exists without storing (for dry run)
   */
  async checkIfExists(commitment: string): Promise<boolean> {
    const exists = await this.betRepository.exists(commitment);

    this.logger.debug({
      commitment,
      exists
    }, 'Checked bet existence');

    return exists;
  }
}