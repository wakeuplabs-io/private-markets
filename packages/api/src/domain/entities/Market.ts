/**
 * @fileoverview Market domain entity
 * Represents a prediction market with its core business logic
 *
 * @module domain/entities/Market
 */

export enum MarketStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled'
}

export class Market {
  constructor(
    public readonly id: number,
    public readonly question: string,
    public readonly admin: string,
    public readonly status: MarketStatus,
    public readonly createdAt: Date,
    public readonly resolvedAt?: Date,
    public readonly winningOutcome?: boolean
  ) {}

  /**
   * Checks if the market is active and accepting bets
   */
  isActive(): boolean {
    return this.status === MarketStatus.ACTIVE;
  }

  /**
   * Checks if the market has been resolved
   */
  isResolved(): boolean {
    return this.status === MarketStatus.RESOLVED;
  }

  /**
   * Gets the market age in days
   */
  getAgeInDays(): number {
    const now = new Date();
    const diffInMs = now.getTime() - this.createdAt.getTime();
    return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Creates a resolved market instance
   */
  static createResolved(
    id: number,
    question: string,
    admin: string,
    createdAt: Date,
    winningOutcome: boolean,
    resolvedAt: Date = new Date()
  ): Market {
    return new Market(
      id,
      question,
      admin,
      MarketStatus.RESOLVED,
      createdAt,
      resolvedAt,
      winningOutcome
    );
  }

  /**
   * Creates an active market instance
   */
  static createActive(
    id: number,
    question: string,
    admin: string,
    createdAt: Date = new Date()
  ): Market {
    return new Market(
      id,
      question,
      admin,
      MarketStatus.ACTIVE,
      createdAt
    );
  }
}