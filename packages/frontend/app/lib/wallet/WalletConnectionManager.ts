import type { IWalletProvider, IWalletAccount, IExtendedWalletProvider, WalletConnector } from "@/types/wallet";
import { walletRegistry } from "./WalletRegistry";

/**
 * Manages wallet connections and interactions
 * Handles connecting, disconnecting, and executing operations with wallet providers
 */
export class WalletConnectionManager {
  private static instance: WalletConnectionManager;
  private currentConnector: WalletConnector | null = null;
  private account: IWalletAccount | null = null;
  private currentProvider: IWalletProvider | null = null;

  private constructor() {}

  static getInstance(): WalletConnectionManager {
    if (!WalletConnectionManager.instance) {
      WalletConnectionManager.instance = new WalletConnectionManager();
    }
    return WalletConnectionManager.instance;
  }

  /**
   * Connect to a wallet provider
   * @param connector - The wallet provider identifier
   * @param options - Optional connection parameters
   * @returns Promise resolving to the connected account
   */
  async connect(connector: WalletConnector, options?: unknown): Promise<IWalletAccount> {
    try {
      this.disconnect();

      const provider = walletRegistry.get(connector);
      if (!provider) {
        throw new Error(`Wallet provider "${connector}" not found. Available providers: ${walletRegistry.getAvailable().join(", ")}`);
      }

      this.account = await provider.connect(options);
      this.currentConnector = connector;
      this.currentProvider = provider;

      return this.account;
    } catch (error) {
      console.error(`Failed to connect to ${connector}:`, error);
      throw error;
    }
  }

  /**
   * Create a new account with the specified provider
   * @param connector - The wallet provider identifier
   * @param options - Optional account creation parameters
   * @returns Promise resolving to the created account
   */
  async createAccount(connector: WalletConnector, options?: unknown): Promise<IWalletAccount> {
    try {
      this.disconnect();

      const provider = walletRegistry.get(connector);
      if (!provider) {
        throw new Error(`Wallet provider "${connector}" not found. Available providers: ${walletRegistry.getAvailable().join(", ")}`);
      }

      const extendedProvider = provider as IExtendedWalletProvider;
      if (!extendedProvider.createAccount) {
        throw new Error(`Wallet provider "${connector}" does not support account creation`);
      }

      this.account = await extendedProvider.createAccount(options);
      this.currentConnector = connector;
      this.currentProvider = provider;

      return this.account;
    } catch (error) {
      console.error(`Failed to create account with ${connector}:`, error);
      throw error;
    }
  }

  /**
   * Connect to a test account
   * @param connector - The wallet provider identifier
   * @param index - Test account index
   * @returns Promise resolving to the connected test account
   */
  async connectTestAccount(connector: WalletConnector, index: number): Promise<IWalletAccount> {
    try {
      this.disconnect();

      const provider = walletRegistry.get(connector);
      if (!provider) {
        throw new Error(`Wallet provider "${connector}" not found. Available providers: ${walletRegistry.getAvailable().join(", ")}`);
      }

      const extendedProvider = provider as IExtendedWalletProvider;
      if (!extendedProvider.connectTestAccount) {
        throw new Error(`Wallet provider "${connector}" does not support test accounts`);
      }

      this.account = await extendedProvider.connectTestAccount(index);
      this.currentConnector = connector;
      this.currentProvider = provider;

      return this.account;
    } catch (error) {
      console.error(`Failed to connect test account with ${connector}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from the current wallet
   */
  disconnect(): void {
    if (this.currentProvider) {
      this.currentProvider.disconnect();
    }
    this.account = null;
    this.currentConnector = null;
    this.currentProvider = null;
  }

  clearAccount(): void {
    if (this.currentProvider) {
      this.currentProvider.clearAccount();
    }
    this.account = null;
    this.currentConnector = null;
    this.currentProvider = null;
  }

  /**
   * Get the currently connected account
   * @returns The connected account or throws if none is connected
   */
  getAccount(): IWalletAccount {
    if (!this.account) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }
    return this.account;
  }

  /**
   * Get the current wallet connector name
   * @returns The connector name or null if not connected
   */
  getCurrentConnector(): WalletConnector | null {
    return this.currentConnector;
  }

  /**
   * Check if a wallet is currently connected
   * @returns True if connected and the provider confirms connection
   */
  isConnected(): boolean {
    return this.account !== null && this.currentProvider !== null && this.currentProvider.isConnected();
  }

  /**
   * Get the address of the connected account
   * @returns The account address or null if not connected
   */
  getAddress() {
    if (!this.account) {
      return null;
    }
    return this.account.getAddress();
  }

  /**
   * Send a transaction using the connected wallet
   * @param interaction - The transaction interaction object
   * @returns Promise that resolves when transaction is sent
   */
  async sendTransaction(interaction: unknown): Promise<void> {
    if (!this.currentProvider) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }

    const extendedProvider = this.currentProvider as IExtendedWalletProvider;
    if (!extendedProvider.sendTransaction) {
      throw new Error(`Current wallet provider does not support sending transactions`);
    }

    return extendedProvider.sendTransaction(interaction);
  }

  /**
   * Simulate a transaction using the connected wallet
   * @param interaction - The transaction interaction object
   * @returns Promise resolving to the simulation result
   */
  async simulateTransaction(interaction: unknown): Promise<unknown> {
    if (!this.currentProvider) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }

    const extendedProvider = this.currentProvider as IExtendedWalletProvider;
    if (!extendedProvider.simulateTransaction) {
      throw new Error(`Current wallet provider does not support simulating transactions`);
    }

    return extendedProvider.simulateTransaction(interaction);
  }

  /**
   * Register a contract with the connected wallet
   * @param artifact - Contract artifact
   * @param deployer - Deployer address
   * @param salt - Deployment salt
   * @param args - Constructor arguments
   * @returns Promise that resolves when contract is registered
   */
  async registerContract(artifact: unknown, deployer: unknown, salt: unknown, args: unknown[]): Promise<void> {
    if (!this.currentProvider) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }

    const extendedProvider = this.currentProvider as IExtendedWalletProvider;
    if (!extendedProvider.registerContract) {
      throw new Error(`Current wallet provider does not support contract registration`);
    }

    return extendedProvider.registerContract(artifact, deployer, salt, args);
  }
}

// Singleton instance
export const walletConnectionManager = WalletConnectionManager.getInstance();