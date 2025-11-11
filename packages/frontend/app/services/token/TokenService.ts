import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { fieldToString } from "@/lib/aztecUtils";
import { walletService } from "../wallet/walletService";
import { TokenProvider } from "./tokenProvider";
import type { ITokenService, ITokenProvider, TokenInfo } from "./types";
import { FALLBACK_VALUES } from "./types";

/**
 * Token Service (Facade + Strategy Pattern)
 *
 * Orchestrates token contract interactions by delegating to the appropriate provider
 * based on wallet connection status:
 *
 * - When wallet is connected → Uses TokenProvider (user's wallet)
 * - When wallet is disconnected → Returns FALLBACK_VALUES without errors
 *
 * This service acts as a facade that:
 * 1. Checks wallet connection status
 * 2. Delegates operations to TokenProvider if connected
 * 3. Returns fallback values if disconnected (graceful degradation)
 * 4. Provides a stable API regardless of connection state
 *
 * Benefits of this architecture:
 * - Single Responsibility: Provider handles wallet interactions only
 * - Graceful Degradation: Returns sensible defaults when disconnected
 * - User Experience: No errors shown for disconnected state
 */
export class TokenService implements ITokenService {
  private static instance: TokenService;

  private readonly privateProvider: ITokenProvider;
  private initializeAddress: string | null = null;

  /**
   * Private constructor for singleton pattern
   * Initializes provider (dependency injection)
   */
  private constructor(
    privateProvider?: ITokenProvider
  ) {
    // Allow dependency injection for testing
    this.privateProvider = privateProvider || new TokenProvider();
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
   * Get complete token information
   * Returns fallback values if wallet is not connected
   *
   * @param address - Token contract address
   * @returns TokenInfo object with all token metadata
   */
  async getTokenInfo(address: string): Promise<TokenInfo> {
    if (!walletService.isConnected()) {
      return {
        name: fieldToString(FALLBACK_VALUES.TOKEN_NAME),
        symbol: fieldToString(FALLBACK_VALUES.TOKEN_SYMBOL),
        decimals: FALLBACK_VALUES.TOKEN_DECIMALS,
        address: AztecAddress.fromString(address),
      };
    }

    try {
      // Fetch metadata in parallel for performance
      const name = await this.getTokenName(address);
      const symbol = await this.getTokenSymbol(address);
      const decimals = await this.getTokenDecimals(address);

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
   * Returns fallback if not connected
   *
   * @param address - Token contract address
   * @returns Token name as string
   */
  async getTokenName(address: string): Promise<string> {
    if (!walletService.isConnected()) {
      return fieldToString(FALLBACK_VALUES.TOKEN_NAME);
    }

    try {
      const name = await this.privateProvider.getTokenName(address);
      return fieldToString(name);
    } catch (error) {
      console.error('[TOKEN] Failed to fetch token name:', error);
      throw new Error('Failed to fetch token name');
    }
  }

  /**
   * Get token symbol
   * Returns fallback if not connected
   *
   * @param address - Token contract address
   * @returns Token symbol as string
   */
  async getTokenSymbol(address: string): Promise<string> {
    if (!walletService.isConnected()) {
      return fieldToString(FALLBACK_VALUES.TOKEN_SYMBOL);
    }

    try {
      const symbol = await this.privateProvider.getTokenSymbol(address);
      return fieldToString(symbol);
    } catch (error) {
      console.error('[TOKEN] Failed to fetch token symbol:', error);
      throw new Error('Failed to fetch token symbol');
    }
  }

  /**
   * Get token decimals
   * Returns fallback if not connected
   *
   * @param address - Token contract address
   * @returns Token decimals as number
   */
  async getTokenDecimals(address: string): Promise<number> {
    if (!walletService.isConnected()) {
      return FALLBACK_VALUES.TOKEN_DECIMALS;
    }

    try {
      return await this.privateProvider.getTokenDecimals(address);
    } catch (error) {
      console.error('[TOKEN] Failed to fetch token decimals:', error);
      throw new Error('Failed to fetch token decimals');
    }
  }

  /**
   * Get private balance for an owner
   * Returns fallback (0) if not connected
   *
   * @param address - Token contract address
   * @param owner - Owner address to query balance for
   * @returns Private balance as bigint
   */
  async getPrivateBalance(address: string, owner: AztecAddress): Promise<bigint> {
    if (!walletService.isConnected()) {
      return FALLBACK_VALUES.BALANCE;
    }

    try {
      return await this.privateProvider.getPrivateBalance(address, owner);
    } catch (error) {
      console.error('[TOKEN] Failed to fetch private token balance:', error);
      throw new Error('Failed to fetch private token balance');
    }
  }

  /**
   * Mint tokens to private balance
   * Requires wallet to be connected
   *
   * @param address - Token contract address
   * @param recipient - Recipient address
   * @param amount - Amount to mint
   * @returns Transaction hash or success message
   */
  async mintToPrivate(address: string, recipient: AztecAddress, amount: bigint): Promise<string> {
    if (!walletService.isConnected()) {
      throw new Error('Wallet must be connected to perform mint operations');
    }

    try {
      if (!this.privateProvider.mintToPrivate) {
        throw new Error('Mint operation not supported by current provider');
      }

      return await this.privateProvider.mintToPrivate(address, recipient, amount);
    } catch (error) {
      console.error('[TOKEN] Failed to mint tokens to private:', error);
      throw new Error(
        `Failed to mint tokens to private: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clear provider cache
   * Useful when switching wallets or resetting state
   */
  clearCache(): void {
    this.privateProvider.clearCache();
  }

  /**
   * Check if wallet is connected
   *
   * @returns true if wallet is connected
   */
  isConnected(): boolean {
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
