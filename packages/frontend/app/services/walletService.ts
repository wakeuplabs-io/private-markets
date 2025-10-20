import { walletConnectionManager, type WalletConnector } from "@/lib/wallet"
import { walletRegistry } from "@/lib/wallet/WalletRegistry";
// Import to ensure providers are initialized before any wallet operations
import "@/lib/wallet/providers";

export interface WalletInfo {
  connector: WalletConnector;
  address: string;
  isConnected: boolean;
}

export class WalletService {
  private static instance: WalletService;

  private constructor() {}

  static getInstance(): WalletService {
    if (!WalletService.instance) {
      WalletService.instance = new WalletService();
    }
    return WalletService.instance;
  }

  async connect(connector: WalletConnector): Promise<WalletInfo> {
    try {
      const account = await walletConnectionManager.connect(connector);

      if (!account) {
        throw new Error(`Failed to connect to ${connector}: No account returned`);
      }

      const addressObj = account.getAddress();
      const addressString = addressObj.toString();

      const walletInfo: WalletInfo = {
        connector,
        address: addressString,
        isConnected: true,
      };

      return walletInfo;

    } catch (error) {
      console.error(`Failed to connect to ${connector}:`, error);
      throw new Error(`Failed to connect to ${connector}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  disconnect(): void {
    walletConnectionManager.disconnect();
  }

  clearAccount(): void {
    walletConnectionManager.clearAccount();
  }

  getWalletInfo(): WalletInfo | null {
    if (!walletConnectionManager.isConnected()) {
      return null;
    }

    const connector = walletConnectionManager.getCurrentConnector();
    const address = walletConnectionManager.getAddress();

    if (!connector || !address) {
      return null;
    }

    return {
      connector,
      address: address.toString(),
      isConnected: true,
    };
  }

  isConnected(): boolean {
    return walletConnectionManager.isConnected();
  }

  getAccount() {
    if (!this.isConnected()) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }
    return walletConnectionManager.getAccount();
  }

  getAddress() {
    const address = walletConnectionManager.getAddress();
    if (!address) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }
    return address;
  }

  getCurrentConnector(): WalletConnector | null {
    return walletConnectionManager.getCurrentConnector();
  }

  async connectWithPersistence(connector: WalletConnector): Promise<WalletInfo> {
    return await this.connect(connector);
  }

  async createAccount(connector: WalletConnector, options?: unknown): Promise<WalletInfo> {
    try {
      const account = await walletConnectionManager.createAccount(connector, options);

      if (!account) {
        throw new Error(`Failed to create account with ${connector}: No account returned`);
      }

      const addressObj = account.getAddress();
      const addressString = addressObj.toString();
      console.log('[WalletService] createAccount - addressObj:', addressObj, 'addressString:', addressString);

      const walletInfo: WalletInfo = {
        connector,
        address: addressString,
        isConnected: true,
      };

      return walletInfo;

    } catch (error) {
      console.error(`Failed to create account with ${connector}:`, error);
      throw new Error(`Failed to create account with ${connector}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendTransaction(interaction: unknown): Promise<void> {
    return walletConnectionManager.sendTransaction(interaction);
  }

  async simulateTransaction(interaction: unknown): Promise<unknown> {
    return walletConnectionManager.simulateTransaction(interaction);
  }

  async registerContract(artifact: unknown, deployer: unknown, salt: unknown, args: unknown[]): Promise<void> {
    return walletConnectionManager.registerContract(artifact, deployer, salt, args);
  }

  /**
   * Check if a wallet provider has an existing account
   * @param connector - The wallet provider identifier
   * @returns Promise resolving to true if account exists
   */
  async hasExistingAccount(connector: WalletConnector): Promise<boolean> {
    try {
      const provider = walletRegistry.get(connector);
      if (!provider) {
        throw new Error(`Wallet provider "${connector}" not found`);
      }

      return provider.hasExistingAccount();
    } catch (error) {
      console.error(`Failed to check existing account for ${connector}:`, error);
      return false;
    }
  }

  /**
   * Get the account status for a wallet provider
   * @param connector - The wallet provider identifier
   * @returns Promise resolving to the account status
   */
  async getAccountStatus(connector: WalletConnector): Promise<'none' | 'exists' | 'connected'> {
    try {
      const provider = walletRegistry.get(connector);
      if (!provider) {
        throw new Error(`Wallet provider "${connector}" not found`);
      }

      return provider.getAccountStatus();
    } catch (error) {
      console.error(`Failed to get account status for ${connector}:`, error);
      return 'none';
    }
  }

  /**
   * Check if a wallet provider is currently initializing
   * @param connector - The wallet provider identifier
   * @returns True if provider is initializing
   */
  isProviderInitializing(connector: WalletConnector): boolean {
    try {
      const provider = walletRegistry.get(connector);
      if (!provider) {
        return false;
      }

      // Check if provider has getIsInitializing method (type assertion)
      const extendedProvider = provider as { getIsInitializing?: () => boolean };
      if (extendedProvider.getIsInitializing) {
        return extendedProvider.getIsInitializing();
      }

      return false;
    } catch (error) {
      console.error(`Failed to check initialization status for ${connector}:`, error);
      return false;
    }
  }
}

export const walletService = WalletService.getInstance();
export default walletService;