import { walletConnection, type WalletConnector } from "../lib/walletSdk";

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
      const account = await walletConnection.connect(connector);

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
    walletConnection.disconnect();
  }

  getWalletInfo(): WalletInfo | null {
    if (!walletConnection.isConnected()) {
      return null;
    }

    const connector = walletConnection.getCurrentConnector();
    const address = walletConnection.getAddress();

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
    return walletConnection.isConnected();
  }

  getAccount() {
    if (!this.isConnected()) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }
    return walletConnection.getAccount();
  }

  getAddress() {
    const address = walletConnection.getAddress();
    if (!address) {
      throw new Error("No wallet connected. Please connect a wallet first.");
    }
    return address;
  }

  getCurrentConnector(): WalletConnector | null {
    return walletConnection.getCurrentConnector();
  }

  async connectWithPersistence(connector: WalletConnector): Promise<WalletInfo> {
    return await this.connect(connector);
  }
}

export const walletService = WalletService.getInstance();
export default walletService;