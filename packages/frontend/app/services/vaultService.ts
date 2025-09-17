import { AzguardVaultProvider, PXEVaultProvider, type IVaultProvider } from "../providers/vaultProvider";
import type { AzguardClient } from "@azguardwallet/client";

export class VaultService {
  private static instance: VaultService;
  private contractAddress: string;
  private provider: IVaultProvider | null = null;

  private constructor() {
    this.contractAddress = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS || "";
    if (!this.contractAddress) {
      throw new Error("NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS not configured");
    }
  }

  public static getInstance(): VaultService {
    if (!VaultService.instance) {
      VaultService.instance = new VaultService();
    }
    return VaultService.instance;
  }

  setAzguardClient(azguardClient: AzguardClient): void {
    this.provider = new AzguardVaultProvider(azguardClient, this.contractAddress);
  }

  clearAzguardClient(): void {
    this.provider = null;
  }

  private getProvider(): IVaultProvider {
    if (this.provider) {
      return this.provider;
    } else {
      return new PXEVaultProvider(this.contractAddress);
    }
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

      // Create empty msg array [7][31] as required by contract
      const msg: number[][] = Array(7).fill(null).map(() => Array(31).fill(0));

      console.log("Placing bet with cleaned parameters:", {
        originalMarketId: params.marketId,
        formattedMarketId,
        outcome: params.outcome,
        amount: params.amount,
        commitment,
        betId,
        authwitNonce,
        originalAddress: params.userAddress,
        cleanedAddress,
        msg: `${msg.length}x${msg[0].length} array`
      });

      // Get token contract address from vault
      const tokenAddress = await provider.getTokenAddress();
      console.log("Token contract address:", tokenAddress);
      
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
      console.error("Failed to place bet:", error);
      throw new Error("Failed to place bet");
    }
  }

  async isBetProcessed(betId: string): Promise<boolean> {
    try {
      const provider = this.getProvider();
      return await provider.isProcessed(betId);
    } catch (error) {
      console.error("Failed to check bet status:", error);
      throw new Error("Failed to check bet status");
    }
  }

  async getTokenAddress(): Promise<string> {
    try {
      const provider = this.getProvider();
      return await provider.getTokenAddress();
    } catch (error) {
      console.error("Failed to get token address:", error);
      throw new Error("Failed to get token address");
    }
  }

  getContractAddress(): string {
    return this.contractAddress;
  }
}

export const vaultService = VaultService.getInstance();