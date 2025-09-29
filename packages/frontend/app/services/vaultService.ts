import { WalletSdkVaultProvider, PXEVaultProvider } from "./vaultProviderService";
import { walletService } from "./walletService";

export class VaultService {
  private static instance: VaultService;
  private contractAddress: string;
  private walletSdkProvider: WalletSdkVaultProvider | null = null;
  private pxeProvider: PXEVaultProvider | null = null;

  private constructor() {
    this.contractAddress = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS || "";
    if (!this.contractAddress) {
      throw new Error("NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS not configured");
    }

    this.walletSdkProvider = new WalletSdkVaultProvider(this.contractAddress);
    this.pxeProvider = new PXEVaultProvider(this.contractAddress);
  }

  public static getInstance(): VaultService {
    if (!VaultService.instance) {
      VaultService.instance = new VaultService();
    }
    return VaultService.instance;
  }

  private getProvider(): WalletSdkVaultProvider | PXEVaultProvider {
    if (walletService.isConnected() && this.walletSdkProvider) {
      return this.walletSdkProvider;
    }

    if (!this.pxeProvider) {
      throw new Error("PXE provider not initialized");
    }

    return this.pxeProvider;
  }

  private cleanAddress(address: string): string {
    if (address.includes(':')) {
      const parts = address.split(':');
      return parts[parts.length - 1];
    }
    return address;
  }

  async placeBet(params: {
    marketId: string;
    outcome: number;
    amount: number;
    userAddress: string;
  }): Promise<string> {
    try {
      const provider = this.getProvider();
      const cleanedAddress = this.cleanAddress(params.userAddress);

      const commitment = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const betId = `0x${Date.now().toString(16)}`;
      const authwitNonce = `0x${(Date.now() + Math.floor(Math.random() * 1000)).toString(16)}`;

      let formattedMarketId = params.marketId;
      if (!formattedMarketId.startsWith('0x')) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(formattedMarketId);
        formattedMarketId = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      }

      const msg: number[][] = Array(7).fill(null).map(() => Array(31).fill(0));
      const tokenAddress = await provider.getTokenAddress();

      const txHash = await provider.placeBet({
        marketId: formattedMarketId,
        outcome: params.outcome,
        amount: params.amount,
        commitment,
        betId,
        authwitNonce,
        from: cleanedAddress,
        msg,
        tokenAddress
      });

      return txHash;

    } catch (error) {
      console.error('[VAULT] Failed to place bet:', error);
      throw new Error(`Failed to place bet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isBetProcessed(betId: string): Promise<boolean> {
    try {
      const provider = this.getProvider();
      return await provider.isProcessed(betId);
    } catch (error) {
      console.error('[VAULT] Failed to check bet status:', error);
      throw new Error(`Failed to check bet status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTokenAddress(): Promise<string> {
    try {
      const provider = this.getProvider();
      return await provider.getTokenAddress();
    } catch (error) {
      console.error('[VAULT] Failed to get token address:', error);
      throw new Error(`Failed to get token address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  clearCache(): void {
    if (this.walletSdkProvider) {
      this.walletSdkProvider.clearCache();
    }
  }

  isWalletSdkAvailable(): boolean {
    return walletService.isConnected() && this.walletSdkProvider !== null;
  }
}

// Create service instance
export const vaultService = VaultService.getInstance();
export default vaultService;