/**
 * @fileoverview In-memory implementation of Market repository
 * Provides mock data for testing and development purposes
 *
 * @module infrastructure/persistence/InMemoryMarketRepository
 */

import { Market, MarketStatus } from '../../domain/entities/Market';
import { IMarketRepository } from '../../domain/repositories/IMarketRepository';

export class InMemoryMarketRepository implements IMarketRepository {
  private markets: Map<number, Market>;

  constructor() {
    this.markets = new Map();
    this.seedMockData();
  }

  async findById(id: number): Promise<Market | null> {
    return this.markets.get(id) || null;
  }

  async findActive(): Promise<Market[]> {
    return Array.from(this.markets.values()).filter(market => market.isActive());
  }

  async findResolved(): Promise<Market[]> {
    return Array.from(this.markets.values()).filter(market => market.isResolved());
  }

  async save(market: Market): Promise<Market> {
    this.markets.set(market.id, market);
    return market;
  }

  async exists(id: number): Promise<boolean> {
    return this.markets.has(id);
  }

  /**
   * Seeds the repository with mock data for testing
   */
  private seedMockData(): void {
    const mockMarkets: Market[] = [
      Market.createActive(
        1,
        "Will Bitcoin reach $100,000 by end of 2024?",
        "0x1234567890abcdef1234567890abcdef12345678",
        new Date("2024-01-01")
      ),
      Market.createActive(
        2,
        "Will Ethereum upgrade to ETH 3.0 this year?",
        "0xabcdef1234567890abcdef1234567890abcdef12",
        new Date("2024-02-15")
      ),
      Market.createResolved(
        3,
        "Will the next US election be held in November 2024?",
        "0x9876543210fedcba9876543210fedcba98765432",
        new Date("2024-01-10"),
        true, // winning outcome = Yes
        new Date("2024-11-05")
      ),
      Market.createResolved(
        4,
        "Will Twitter rebrand to X be successful?",
        "0xfedcba9876543210fedcba9876543210fedcba98",
        new Date("2023-07-01"),
        false, // winning outcome = No
        new Date("2024-01-01")
      ),
      new Market(
        5,
        "Will AI achieve AGI by 2030?",
        "0x5555555555555555555555555555555555555555",
        MarketStatus.CANCELLED,
        new Date("2024-03-01")
      )
    ];

    mockMarkets.forEach(market => {
      this.markets.set(market.id, market);
    });
  }

  /**
   * Gets all markets (for debugging/admin purposes)
   */
  async findAll(): Promise<Market[]> {
    return Array.from(this.markets.values());
  }

  /**
   * Clears all markets (for testing purposes)
   */
  async clear(): Promise<void> {
    this.markets.clear();
  }

  /**
   * Gets the total count of markets
   */
  async count(): Promise<number> {
    return this.markets.size;
  }
}