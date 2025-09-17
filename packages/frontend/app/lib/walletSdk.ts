"use client";

import { AztecWalletSdk, obsidion } from "@nemi-fi/wallet-sdk";

const getNodeUrl = () => {
  return process.env.NEXT_PUBLIC_PXE_URL || "http://localhost:8080";
};

let walletSdkInstance: AztecWalletSdk | null = null;

export const getWalletSdk = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  walletSdkInstance = new AztecWalletSdk({
    aztecNode: getNodeUrl(),
    connectors: [
      obsidion(),
    ],
  });

  return walletSdkInstance;
};

export const clearWalletSdk = () => {
  walletSdkInstance = null;
};

export type WalletConnector = "obsidion" | "azguard" | "pxe";

interface WalletAccount {
  getAddress(): { toString(): string };
}

// Connection management class
export class WalletConnectionManager {
  private static instance: WalletConnectionManager;
  private currentConnector: WalletConnector | null = null;
  private account: WalletAccount | null = null;

  private constructor() {}

  static getInstance(): WalletConnectionManager {
    if (!WalletConnectionManager.instance) {
      WalletConnectionManager.instance = new WalletConnectionManager();
    }
    return WalletConnectionManager.instance;
  }

  async connect(connector: WalletConnector) {
    try {
      this.account = null;
      this.currentConnector = null;
      clearWalletSdk();

      if (connector === "obsidion" || connector === "azguard") {
        const sdk = getWalletSdk();
        if (!sdk) {
          throw new Error("Wallet SDK not available (running on server?)");
        }

        this.account = await sdk.connect("obsidion") as WalletAccount;
        this.currentConnector = "obsidion";
      }

      return this.account;
    } catch (error) {
      console.error(`Failed to connect to ${connector}:`, error);
      throw error;
    }
  }

  disconnect() {
    this.account = null;
    this.currentConnector = null;
    clearWalletSdk();
  }

  getAccount() {
    if (!this.account) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }
    return this.account;
  }

  getCurrentConnector(): WalletConnector | null {
    return this.currentConnector;
  }

  isConnected(): boolean {
    return this.account !== null;
  }

  getAddress() {
    if (!this.account) {
      return null;
    }
    return this.account.getAddress();
  }

}

export const walletConnection = WalletConnectionManager.getInstance();

export async function ensureWalletConnected() {
  if (!walletConnection.isConnected()) {
    throw new Error("Wallet not connected. Please connect a wallet first.");
  }
  return walletConnection.getAccount();
}