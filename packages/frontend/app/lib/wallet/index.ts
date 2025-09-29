// Core wallet management exports
export { WalletRegistry, walletRegistry } from "./WalletRegistry";
export { WalletConnectionManager, walletConnectionManager } from "./WalletConnectionManager";

// Types
export type {
  IWalletAccount,
  IWalletProvider,
  IExtendedWalletProvider,
  WalletProviderConfig,
  WalletConnector
} from "@/types/wallet";

// Wallet connection utility
export async function ensureWalletConnected() {
  const { walletConnectionManager } = await import("./WalletConnectionManager");
  if (!walletConnectionManager.isConnected()) {
    throw new Error("Wallet not connected. Please connect a wallet first.");
  }
  const account = walletConnectionManager.getAccount();

  if ('getAccountWallet' in account && typeof account.getAccountWallet === 'function') {
    return (account as any).getAccountWallet();
  }

  return account;
}