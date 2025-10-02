import type { PXE, AuthWitness, AztecAddress } from "@aztec/aztec.js";

// Core wallet interfaces
export interface IWalletAccount {
  getAddress(): { toString(): string };
}

export interface IWalletProvider {
  connect(options?: unknown): Promise<IWalletAccount>;
  disconnect(): void;
  clearAccount(): void;
  getAccount(): IWalletAccount | null;
  isConnected(): boolean;
  getProviderName(): string;
  hasExistingAccount(): boolean;
  getAccountStatus(): 'none' | 'exists' | 'connected';
}

export interface IExtendedWalletProvider extends IWalletProvider {
  createAccount(options?: unknown): Promise<IWalletAccount>;
  sendTransaction(interaction: unknown, authWitnesses?: AuthWitness[], from?: AztecAddress): Promise<void>;
  simulateTransaction(interaction: unknown): Promise<unknown>;
  registerContract(artifact: unknown, deployer: unknown, salt: unknown, args: unknown[]): Promise<void>;
  connectTestAccount?(index: number): Promise<IWalletAccount>;
}

export interface WalletProviderConfig {
  name: string;
  provider: IWalletProvider;
}

export type WalletConnector = string;

// Wallet context types
export type WalletConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type AccountStatus = 'checking' | 'none' | 'exists' | 'connected'

export type WalletType = 'aztec' | 'ethereum' | 'metamask'

export interface WalletInfo {
  address: string
  type: WalletType
  chainId?: number
  balance?: {
    eth?: string
    usdc?: string
  }
  pxe?: PXE
  accounts?: string[]
}

export interface WalletState {
  status: WalletConnectionStatus
  accountStatus: AccountStatus
  wallet: WalletInfo | null
  error: string | null
}

export interface ConnectWalletOptions {
  type: WalletType
  chainId?: number
}

export interface ConnectResult {
  pxe?: PXE
}