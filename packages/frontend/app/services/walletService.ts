import { walletConnectionManager, type WalletConnector } from "@/lib/wallet";

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

      const walletInfo: WalletInfo = {
        connector,
        address: account.getAddress().toString(),
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

      const walletInfo: WalletInfo = {
        connector,
        address: account.getAddress().toString(),
        isConnected: true,
      };

      return walletInfo;

    } catch (error) {
      console.error(`Failed to create account with ${connector}:`, error);
      throw new Error(`Failed to create account with ${connector}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async connectTestAccount(connector: WalletConnector, index: number): Promise<WalletInfo> {
    try {
      const account = await walletConnectionManager.connectTestAccount(connector, index);

      if (!account) {
        throw new Error(`Failed to connect test account with ${connector}: No account returned`);
      }

      const walletInfo: WalletInfo = {
        connector,
        address: account.getAddress().toString(),
        isConnected: true,
      };

      return walletInfo;

    } catch (error) {
      console.error(`Failed to connect test account with ${connector}:`, error);
      throw new Error(`Failed to connect test account with ${connector}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
}

export const walletService = WalletService.getInstance();
export default walletService;