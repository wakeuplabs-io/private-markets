import { Bet } from "@/types";

export interface BetParams {
  marketId: string;
  outcome: number;
  amount: number;
  commitment: string;
  betId: string;
  authwitNonce: string;
  from: string;
  msg: number[][];
  tokenAddress: string;
}

export interface SimpleBetParams {
  marketId: string;
  outcome: number;
  amount: number;
  userAddress: string;
}

/**
 * Vault provider interface
 * - PrivateVaultProvider: Full access (READ + WRITE)
 */
export interface IVaultProvider {
  getContract(): Promise<unknown>;
  placeBet?(params: BetParams): Promise<string>;
  isProcessed(betId: string): Promise<boolean>;
  getTokenAddress(): Promise<string>;
  getUserBets?(): Promise<Bet[]>;
  clearCache(): void;
}

export interface IVaultService {
  placeBet(params: SimpleBetParams): Promise<string>;
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
