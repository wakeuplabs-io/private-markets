import { AztecAddress } from "@aztec/aztec.js";
import { fieldToString } from "@/lib/aztecUtils";
import { walletService } from "../walletService";
import { PrivateTokenProvider } from "./PrivateTokenProvider";
import { PublicTokenProvider } from "./PublicTokenProvider";
import type { ITokenService, ITokenProvider, TokenInfo } from "./types";

/**
 * Token Service (Facade + Strategy Pattern)
 *
 * Orchestrates token contract interactions by delegating to the appropriate provider
 * based on wallet connection status:
 *
 * - When wallet is connected → Uses PrivateTokenProvider (user's wallet)
 * - When wallet is disconnected → Uses PublicTokenProvider (PXE test accounts)
 *
 * This service acts as a facade that:
 * 1. Selects the appropriate provider strategy
 * 2. Delegates operations to the selected provider
 * 3. Transforms raw provider responses into application-level types
 * 4. Provides a stable API regardless of underlying provider
 *
 * Benefits of this architecture:
 * - Single Responsibility: Each provider handles one context
 * - Open/Closed: Easy to add new providers without modifying service
 * - Dependency Inversion: Service depends on ITokenProvider abstraction
 * - Strategy Pattern: Runtime provider selection based on state
 */
export class TokenService implements ITokenService {
  private static instance: TokenService;

  private readonly privateProvider: ITokenProvider;
  private readonly publicProvider: ITokenProvider;
  private initializeAddress: string | null = null;

  /**
   * Private constructor for singleton pattern
   * Initializes both providers (dependency injection)
   */
  private constructor(
    privateProvider?: ITokenProvider,
    publicProvider?: ITokenProvider
  ) {
    // Allow dependency injection for testing
    this.privateProvider = privateProvider || new PrivateTokenProvider();
    this.publicProvider = publicProvider || new PublicTokenProvider();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  /**
   * Initialize service with default contract address
   * This is optional and used for backward compatibility
   */
  initialize(contractAddress: string): void {
    this.initializeAddress = contractAddress;
  }

  /**
   * Get active provider based on wallet connection status
   * Strategy selection happens here
   *
   * @returns PrivateTokenProvider if wallet is connected, PublicTokenProvider otherwise
   */
  private getProvider(): ITokenProvider {
    const isConnected = walletService.isConnected();
    return isConnected ? this.privateProvider : this.publicProvider;
  }

  /**
   * Get complete token information
   * Fetches name, symbol, and decimals in parallel
   *
   * @param address - Token contract address
   * @returns TokenInfo object with all token metadata
   */
  async getTokenInfo(address: string): Promise<TokenInfo> {
    try {
      // Fetch metadata in parallel for performance
      const [name, symbol, decimals] = await Promise.all([
        this.getTokenName(address),
        this.getTokenSymbol(address),
        this.getTokenDecimals(address),
      ]);

      const tokenInfo: TokenInfo = {
        name,
        symbol,
        decimals,
        address: AztecAddress.fromString(address),
      };

      return tokenInfo;
    } catch (error) {
      console.error('[TOKEN] Failed to fetch token information:', error);
      throw new Error(
        `Failed to fetch token information: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get token name
   * Delegates to active provider and transforms response to string
   *
   * @param address - Token contract address
   * @returns Token name as string
   */
  async getTokenName(address: string): Promise<string> {
    try {
      const provider = this.getProvider();
      const name = await provider.getTokenName(address);
      return fieldToString(name);
    } catch (error) {
      console.error('[TOKEN] Failed to fetch token name:', error);
      throw new Error('Failed to fetch token name');
    }
  }

  /**
   * Get token symbol
   * Delegates to active provider and transforms response to string
   *
   * @param address - Token contract address
   * @returns Token symbol as string
   */
  async getTokenSymbol(address: string): Promise<string> {
    try {
      const provider = this.getProvider();
      const symbol = await provider.getTokenSymbol(address);
      return fieldToString(symbol);
    } catch (error) {
      console.error('[TOKEN] Failed to fetch token symbol:', error);
      throw new Error('Failed to fetch token symbol');
    }
  }

  /**
   * Get token decimals
   * Delegates to active provider
   *
   * @param address - Token contract address
   * @returns Token decimals as number
   */
  async getTokenDecimals(address: string): Promise<number> {
    try {
      const provider = this.getProvider();
      return await provider.getTokenDecimals(address);
    } catch (error) {
      console.error('[TOKEN] Failed to fetch token decimals:', error);
      throw new Error('Failed to fetch token decimals');
    }
  }

  /**
   * Get private balance for an owner
   * Delegates to active provider
   *
   * Note: Behavior differs by provider:
   * - PrivateTokenProvider: Uses connected wallet's permissions
   * - PublicTokenProvider: Uses test account permissions
   *
   * @param address - Token contract address
   * @param owner - Owner address to query balance for
   * @returns Private balance as bigint
   */
  async getPrivateBalance(address: string, owner: AztecAddress): Promise<bigint> {
    try {
      const provider = this.getProvider();
      return await provider.getPrivateBalance(address, owner);
    } catch (error) {
      console.error('[TOKEN] Failed to fetch private token balance:', error);
      throw new Error('Failed to fetch private token balance');
    }
  }

  /**
   * Mint tokens to private balance
   * Delegates to active provider
   *
   * Note: Requires wallet to be connected in production
   * - PrivateTokenProvider: Submits transaction through user's wallet
   * - PublicTokenProvider: Submits transaction through test wallet
   *
   * @param address - Token contract address
   * @param recipient - Recipient address
   * @param amount - Amount to mint
   * @returns Transaction hash or success message
   */
  async mintToPrivate(address: string, recipient: AztecAddress, amount: bigint): Promise<string> {
    try {
      if (!walletService.isConnected()) {
        throw new Error('Wallet must be connected to perform mint operations');
      }

      const provider = this.getProvider();
      if (!provider.mintToPrivate) {
        throw new Error('Mint operation not supported by current provider');
      }

      return await provider.mintToPrivate(address, recipient, amount);
    } catch (error) {
      console.error('[TOKEN] Failed to mint tokens to private:', error);
      throw new Error(
        `Failed to mint tokens to private: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clear all provider caches
   * Useful when switching wallets or resetting state
   */
  clearCache(): void {
    this.privateProvider.clearCache();
    this.publicProvider.clearCache();
  }

  /**
   * Get current active provider type
   *
   * @returns 'private' if wallet is connected, 'public' otherwise
   */
  getCurrentProviderType(): 'private' | 'public' {
    return walletService.isConnected() ? 'private' : 'public';
  }

  /**
   * Check if private provider is available (wallet connected)
   *
   * @returns true if wallet is connected
   */
  isPrivateProviderAvailable(): boolean {
    return walletService.isConnected();
  }
}

/**
 * Singleton instance export
 * Import this in your application code
 */
export const tokenService = TokenService.getInstance();

/**
 * Default export for convenience
 */
export default tokenService;
