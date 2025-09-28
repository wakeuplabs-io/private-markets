/**
 * @fileoverview BetRecord domain entity
 * Represents a bet record with its core business logic
 *
 * @module domain/entities/BetRecord
 */

export class BetRecord {
  constructor(
    public readonly marketId: number,
    public readonly commitment: string,
    public readonly amount: bigint,
    public readonly outcome: boolean,
    public readonly betId: string,
    public readonly blockNumber: number,
    public readonly timestamp: Date = new Date()
  ) {}

  /**
   * Checks if this bet is a winner for a given market outcome
   */
  isWinner(winningOutcome: boolean): boolean {
    return this.outcome === winningOutcome;
  }

  /**
   * Gets the bet amount in a human-readable format (as decimal string)
   */
  getAmountAsDecimal(decimals: number = 18): string {
    const divisor = BigInt(10 ** decimals);
    const wholePart = this.amount / divisor;
    const fractionalPart = this.amount % divisor;

    if (fractionalPart === 0n) {
      return wholePart.toString();
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    return `${wholePart}.${fractionalStr.replace(/0+$/, '')}`;
  }

  /**
   * Gets the outcome as a human-readable string
   */
  getOutcomeLabel(): string {
    return this.outcome ? 'Yes' : 'No';
  }

  /**
   * Validates the bet record structure
   */
  isValid(): boolean {
    return (
      this.marketId > 0 &&
      this.commitment.length > 0 &&
      this.amount > 0n &&
      this.betId.length > 0 &&
      this.blockNumber > 0
    );
  }

  /**
   * Creates a BetRecord from blockchain event data
   */
  static fromBlockchainEvent(
    marketId: number,
    betId: string,
    outcome: boolean,
    amount: bigint,
    commitment: string,
    blockNumber: number
  ): BetRecord {
    return new BetRecord(
      marketId,
      commitment,
      amount,
      outcome,
      betId,
      blockNumber
    );
  }
}