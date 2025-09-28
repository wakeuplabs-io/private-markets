/**
 * @fileoverview GetMarketById use case
 * Handles the business logic for retrieving a market by its ID
 *
 * @module application/use-cases/GetMarketById
 */

import { IMarketRepository } from '../../domain/repositories/IMarketRepository';
import { GetMarketResponse, createGetMarketResponse } from '../dto/GetMarketResponse';

/**
 * Error thrown when a market is not found
 */
export class MarketNotFoundError extends Error {
  constructor(marketId: number) {
    super(`Market with ID ${marketId} not found`);
    this.name = 'MarketNotFoundError';
  }
}

/**
 * Use case for retrieving a market by its ID
 */
export class GetMarketById {
  constructor(private marketRepository: IMarketRepository) {}

  /**
   * Executes the use case to get a market by ID
   * @param marketId - The ID of the market to retrieve
   * @returns Promise resolving to the market response DTO
   * @throws MarketNotFoundError if the market doesn't exist
   */
  async execute(marketId: number): Promise<GetMarketResponse> {
    // Validate input
    if (!Number.isInteger(marketId) || marketId <= 0) {
      throw new Error('Market ID must be a positive integer');
    }

    // Retrieve market from repository
    const market = await this.marketRepository.findById(marketId);

    if (!market) {
      throw new MarketNotFoundError(marketId);
    }

    // Convert domain entity to DTO
    return createGetMarketResponse(market);
  }

  /**
   * Checks if a market exists without retrieving its full data
   * @param marketId - The ID of the market to check
   * @returns Promise resolving to true if market exists, false otherwise
   */
  async marketExists(marketId: number): Promise<boolean> {
    if (!Number.isInteger(marketId) || marketId <= 0) {
      return false;
    }

    return await this.marketRepository.exists(marketId);
  }
}