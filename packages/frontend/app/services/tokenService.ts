import { AztecAddress } from "@aztec/aztec.js";
import type { TokenInfo, ITokenService } from "@/types/token";
import { fieldToString } from "@/lib/aztecUtils";
import { WalletSdkTokenProvider, PXETokenProvider } from "./tokenProviderService";
import { walletService } from "./walletService";

class TokenService implements ITokenService {
  private static instance: TokenService;
  private walletSdkProvider: WalletSdkTokenProvider | null = null;

  private constructor() {}

  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  initialize(contractAddress: string): void {
    this.walletSdkProvider = new WalletSdkTokenProvider(contractAddress);
  }

  private getProvider(address: string) {
    if (walletService.isConnected() && this.walletSdkProvider) {
      return this.walletSdkProvider;
    }
    return new PXETokenProvider(address);
  }

  async getTokenInfo(address: string): Promise<TokenInfo> {
    try {
      const provider = this.getProvider(address);
      const [name, symbol, decimals] = await Promise.all([
        provider.getTokenName(),
        provider.getTokenSymbol(),
        provider.getTokenDecimals(),
      ]);

      const tokenInfo: TokenInfo = {
        name: fieldToString(name),
        symbol: fieldToString(symbol),
        decimals,
        address: AztecAddress.fromString(address),
      };

      return tokenInfo;

    } catch (error) {
      console.error('[TOKEN] Failed to fetch token information:', error);
      throw new Error(`Failed to fetch token information: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTokenName(address: string): Promise<string> {
    try {
      const provider = this.getProvider(address);
      const name = await provider.getTokenName();
      return fieldToString(name);
    } catch (error) {
      console.error('[TOKEN] Failed to fetch token name:', error);
      throw new Error("Failed to fetch token name");
    }
  }

  async getTokenSymbol(address: string): Promise<string> {
    try {
      const provider = this.getProvider(address);
      const symbol = await provider.getTokenSymbol();
      return fieldToString(symbol);
    } catch (error) {
      console.error('[TOKEN] Failed to fetch token symbol:', error);
      throw new Error("Failed to fetch token symbol");
    }
  }

  async getTokenDecimals(address: string): Promise<number> {
    try {
      const provider = this.getProvider(address);
      return await provider.getTokenDecimals();
    } catch (error) {
      console.error('[TOKEN] Failed to fetch token decimals:', error);
      throw new Error("Failed to fetch token decimals");
    }
  }

  async getPrivateBalance(address: string, owner: AztecAddress): Promise<bigint> {
    try {
      const provider = this.getProvider(address);
      return await provider.getPrivateBalance(owner);
    } catch (error) {
      console.error('[TOKEN] Failed to fetch private token balance:', error);
      throw new Error("Failed to fetch private token balance");
    }
  }

  async mintToPrivate(address: string, recipient: AztecAddress, amount: bigint): Promise<string> {
    try {
      if (!walletService.isConnected()) {
        throw new Error("Wallet must be connected to perform mint operations");
      }

      const provider = this.getProvider(address);
      const txHash = await provider.mintToPrivate(recipient, amount);

      return txHash;

    } catch (error) {
      console.error('[TOKEN] Failed to mint tokens to private:', error);
      throw new Error(`Failed to mint tokens to private: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  clearCache(): void {
    if (this.walletSdkProvider) {
      this.walletSdkProvider.clearCache();
    }
  }

  getCurrentProviderType(): 'wallet-sdk' | 'pxe' {
    if (walletService.isConnected() && this.walletSdkProvider) {
      return 'wallet-sdk';
    }
    return 'pxe';
  }

  isWalletSdkAvailable(): boolean {
    return walletService.isConnected() && this.walletSdkProvider !== null;
  }

}

export const tokenService = TokenService.getInstance();
export default tokenService;