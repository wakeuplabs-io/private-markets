/**
 * @fileoverview DTO for blockchain events
 * Represents data structure for events received from blockchain
 *
 * @module application/dto/BlockchainEventDTO
 */

/**
 * Data Transfer Object for BetReceived blockchain events
 */
export interface BlockchainEventDTO {
  marketId: number;
  betId: string;
  outcome: boolean;
  amount: bigint;
  commitment: string;
  blockNumber: number;
  transactionHash: string;
}