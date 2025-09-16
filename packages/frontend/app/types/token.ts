import type { AztecAddress } from "@aztec/aztec.js";

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  address: AztecAddress;
}

export type TokenInfoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: TokenInfo }
  | { status: "error"; error: string };

export interface ITokenService {
  getTokenInfo(address: string): Promise<TokenInfo>;
  getTokenName(address: string): Promise<string>;
  getTokenSymbol(address: string): Promise<string>;
  getTokenDecimals(address: string): Promise<number>;
}

export interface TokenDisplayProps {
  tokenInfo?: TokenInfo;
  loading?: boolean;
  error?: string;
  className?: string;
}