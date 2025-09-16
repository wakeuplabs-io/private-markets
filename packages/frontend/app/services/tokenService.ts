import { AztecAddress } from "@aztec/aztec.js";
import type { TokenInfo, ITokenService } from "@/types/token";
import { fieldToString } from "@/lib/aztecUtils";
import type { AzguardClient } from "@azguardwallet/client";
import { AzguardTokenProvider, PXETokenProvider, type ITokenProvider } from "../providers/tokenProvider";

class TokenService implements ITokenService {
  private static instance: TokenService;
  private provider: ITokenProvider | null = null;

  private constructor() {}

  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  setAzguardClient(azguardClient: AzguardClient, contractAddress: string): void {
    this.provider = new AzguardTokenProvider(azguardClient, contractAddress);
  }

  clearAzguardClient(): void {
    this.provider = null;
  }

  private getProvider(address: string): ITokenProvider {
    if (this.provider) {
      return this.provider;
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

      return {
        name: fieldToString(name),
        symbol: fieldToString(symbol),
        decimals,
        address: AztecAddress.fromString(address),
      };
    } catch (error) {
      throw new Error(`Failed to fetch token information: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTokenName(address: string): Promise<string> {
    try {
      const provider = this.getProvider(address);
      const name = await provider.getTokenName();
      return fieldToString(name);
    } catch {
      throw new Error("Failed to fetch token name");
    }
  }

  async getTokenSymbol(address: string): Promise<string> {
    try {
      const provider = this.getProvider(address);
      const symbol = await provider.getTokenSymbol();
      return fieldToString(symbol);
    } catch {
      throw new Error("Failed to fetch token symbol");
    }
  }

  async getTokenDecimals(address: string): Promise<number> {
    try {
      const provider = this.getProvider(address);
      return await provider.getTokenDecimals();
    } catch {
      throw new Error("Failed to fetch token decimals");
    }
  }

  async getPrivateBalance(address: string, owner: AztecAddress): Promise<bigint> {
    try {
      const provider = this.getProvider(address);
      return await provider.getPrivateBalance(owner);
    } catch {
      throw new Error("Failed to fetch private token balance");
    }
  }

  async mintToPrivate(address: string, recipient: AztecAddress, amount: bigint): Promise<string> {
    try {
      const provider = this.getProvider(address);
      return await provider.mintToPrivate(recipient, amount);
    } catch (error) {
      throw new Error(`Failed to mint tokens to private: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  clearCache(): void {
    // Delegate to PXE provider if needed
    if (!this.provider) {
      const pxeProvider = new PXETokenProvider("");
      pxeProvider.clearCache();
    }
  }
}

export const tokenService = TokenService.getInstance();
export default tokenService;