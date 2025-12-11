import { AztecAddress } from "@aztec/stdlib/aztec-address";

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  address: AztecAddress;
  privateBalance?: bigint;
}

/**
 * Token provider interface
 * - TokenProvider: Full access (READ + WRITE)
 * - PublicTokenProvider: Read-only (throws on write ops)
 */
export interface ITokenProvider {
  getTokenName(address: string): Promise<unknown>;
  getTokenSymbol(address: string): Promise<unknown>;
  getTokenDecimals(address: string): Promise<number>;
  getPrivateBalance(address: string, owner: AztecAddress): Promise<bigint>;
  mintToPrivate?(address: string, recipient: AztecAddress, amount: bigint): Promise<string>;
  clearCache(): void;
}

export interface ITokenService {
  initialize(contractAddress: string): void;
  getTokenInfo(address: string): Promise<TokenInfo>;
  getTokenName(address: string): Promise<string>;
  getTokenSymbol(address: string): Promise<string>;
  getTokenDecimals(address: string): Promise<number>;
  getPrivateBalance(address: string, owner: AztecAddress): Promise<bigint>;
  mintToPrivate(address: string, recipient: AztecAddress, amount: bigint): Promise<string>;
  clearCache(): void;
}

export const FALLBACK_VALUES = {
  TOKEN_NAME: "N/A",
  TOKEN_SYMBOL: "N/A",
  TOKEN_DECIMALS: 18,
  BALANCE: BigInt(0),
  ERROR_MESSAGE: "Data not available"
} as const;
