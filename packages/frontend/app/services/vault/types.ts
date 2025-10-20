import { Bet } from "@/types";

export interface BetParams {
  marketId: string;
  outcome: number;
  amount: number;
  commitment: string;
  betId: string;
  authwitNonce: string;
  from: string;
  tokenAddress: string;
  secret: string; // Secret used to generate the commitment
}

export interface SimpleBetParams {
  marketId: string;
  outcome: number;
  amount: number;
  userAddress: string;
}

export interface ClaimParams {
  marketId: string;
  commitment: string;
  secret: string;
  recipient: string; // Aztec address for recipient
  deadline: string;
  authwitNonce: string;
  betAmount: number;
}

export interface SimpleClaimParams {
  marketId: string;
  betId: string; // To retrieve from localStorage
  recipient: string; // Aztec address for payout
}

/**
 * Vault provider interface
 * - PrivateVaultProvider: Full access (READ + WRITE)
 */
export interface IVaultProvider {
  getContract(): Promise<unknown>;
  placeBet?(params: BetParams): Promise<string>;
  authorizeClaim?(params: ClaimParams): Promise<string>;
  isProcessed(betId: string): Promise<boolean>;
  getTokenAddress(): Promise<string>;
  getUserBets?(): Promise<Bet[]>;
  clearCache(): void;
}

export interface IVaultService {
  placeBet(params: SimpleBetParams): Promise<string>;
  authorizeClaim(params: SimpleClaimParams): Promise<string>;
  isBetProcessed(betId: string): Promise<boolean>;
  getTokenAddress(): Promise<string>;
  getContractAddress(): string;
  clearCache(): void;
  isPrivateProviderAvailable(): boolean;
}

export const FALLBACK_VALUES = {
  TOKEN_ADDRESS: "0x0000000000000000000000000000000000000000000000000000000000000000",
  BET_PROCESSED: false,
  ERROR_MESSAGE: "Data not available"
} as const;
