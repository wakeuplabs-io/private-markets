// Core wallet management exports
export { WalletRegistry, walletRegistry } from "./walletRegistry";
export { WalletConnectionManager, walletConnectionManager } from "./walletConnectionManager";

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
  const { walletConnectionManager } = await import("./walletConnectionManager");
  if (!walletConnectionManager.isConnected()) {
    throw new Error("Wallet not connected. Please connect a wallet first.");
  }
  const account = walletConnectionManager.getAccount();

  if ('getAccountWallet' in account && typeof account.getAccountWallet === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (account as any).getAccountWallet();
  }

  return account;
}