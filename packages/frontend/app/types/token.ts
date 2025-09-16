import type { AztecAddress } from "@aztec/aztec.js";

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  address: AztecAddress;
  privateBalance?: bigint;
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
  getPrivateBalance(address: string, owner: AztecAddress): Promise<bigint>;
  mintToPrivate(address: string, recipient: AztecAddress, amount: bigint): Promise<string>;
}

export interface TokenDisplayProps {
  tokenInfo?: TokenInfo;
  loading?: boolean;
  error?: string;
  className?: string;
}

export interface TokenActions {
  mintToPrivate: (recipient: AztecAddress, amount: bigint) => Promise<string>;
  refreshBalance: () => Promise<void>;
}

export type TokenActionsState = {
  isMinting: boolean;
  isRefreshing: boolean;
  mintError?: string;
  balanceError?: string;
  lastTxHash?: string;
};

export interface TokenWithActions {
  tokenInfo?: TokenInfo;
  actions: TokenActions;
  state: TokenActionsState;
}