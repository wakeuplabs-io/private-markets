import { Bet } from "@/types";
import { walletService } from "../walletService";
import { PrivateVaultProvider } from "./PrivateVaultProvider";
import type { IVaultService, IVaultProvider, SimpleBetParams, BetParams } from "./types";
import { FALLBACK_VALUES } from "./types";

/**
 * Vault Service (Facade Pattern)
 *
 * Orchestrates vault contract interactions by delegating to the appropriate provider
 * based on wallet connection status:
 *
 * - When wallet is connected → Uses PrivateVaultProvider (user's wallet)
 * - When wallet is disconnected → Returns FALLBACK_VALUES without errors
 *
 * This service acts as a facade that:
 * 1. Checks wallet connection status
 * 2. Delegates operations to PrivateVaultProvider if connected
 * 3. Returns fallback values if disconnected (graceful degradation)
 * 4. Handles parameter transformation (simplified API → full params)
 *
 * Benefits of this architecture:
 * - Single Responsibility: Provider handles wallet interactions only
 * - Graceful Degradation: Returns sensible defaults when disconnected
 * - User Experience: No errors shown for disconnected state
 */
export class VaultService implements IVaultService {
  private static instance: VaultService;

  private readonly privateProvider: IVaultProvider;
  private readonly contractAddress: string;

  /**
   * Private constructor for singleton pattern
   * Initializes provider (dependency injection)
   */
  private constructor(
    contractAddress?: string,
    privateProvider?: IVaultProvider
  ) {
    // Get contract address from environment
    this.contractAddress = contractAddress || process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS || "";

    if (!this.contractAddress) {
      throw new Error("NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS not configured");
    }

    // Allow dependency injection for testing
    this.privateProvider = privateProvider || new PrivateVaultProvider(this.contractAddress);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): VaultService {
    if (!VaultService.instance) {
      VaultService.instance = new VaultService();
    }
    return VaultService.instance;
  }

  /**
   * Clean address helper
   * Removes any prefix information from address (e.g., "aztec:address" → "address")
   */
  private cleanAddress(address: string): string {
    if (address.includes(':')) {
      const parts = address.split(':');
      return parts[parts.length - 1];
    }
    return address;
  }

  /**
   * Transform simplified bet params to full bet params
   * Generates commitment, betId, and authwitNonce automatically
   *
   * @param params - Simplified bet parameters from user
   * @returns Full bet parameters for provider
   */
  private async transformBetParams(params: SimpleBetParams): Promise<BetParams> {
    const cleanedAddress = this.cleanAddress(params.userAddress);

    // Generate commitment (in production, this should be derived from a secret)
    const commitment = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    // Generate unique bet ID based on timestamp
    const betId = `0x${Date.now().toString(16)}`;

    // Generate nonce for authorization witness
    const authwitNonce = `0x${(Date.now() + Math.floor(Math.random() * 1000)).toString(16)}`;

    // Format market ID to hex if needed
    const formattedMarketId = params.marketId;

    // Create message array (7x31 matrix of zeros)
    const msg: number[][] = Array(7).fill(null).map(() => Array(31).fill(0));

    // Get token address from vault
    const tokenAddress = await this.getTokenAddress();

    return {
      marketId: formattedMarketId,
      outcome: params.outcome,
      amount: params.amount,
      commitment,
      betId,
      authwitNonce,
      from: cleanedAddress,
      msg,
      tokenAddress
    };
  }

  /**
   * Place a bet on a market
   * Requires wallet to be connected
   *
   * Automatically handles:
   * - Commitment generation
   * - Bet ID generation
   * - Authorization nonce generation
   * - Market ID formatting
   * - Token address resolution
   *
   * @param params - Simplified bet parameters
   * @returns Transaction hash
   */
  async placeBet(params: SimpleBetParams): Promise<string> {
    if (!walletService.isConnected()) {
      throw new Error('Wallet must be connected to place bets');
    }

    try {
      // Transform simplified params to full params
      const fullParams = await this.transformBetParams(params);

      if (!this.privateProvider.placeBet) {
        throw new Error('Place bet operation not supported by current provider');
      }

      const txHash = await this.privateProvider.placeBet(fullParams);

      return txHash;
    } catch (error) {
      console.error('[VAULT] Failed to place bet:', error);
      throw new Error(`Failed to place bet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a bet has been processed
   * Returns fallback if not connected
   *
   * @param betId - Bet ID to check
   * @returns true if bet has been processed, false otherwise
   */
  async isBetProcessed(betId: string): Promise<boolean> {
    if (!walletService.isConnected()) {
      return FALLBACK_VALUES.BET_PROCESSED;
    }

    try {
      return await this.privateProvider.isProcessed(betId);
    } catch (error) {
      console.error('[VAULT] Failed to check bet status:', error);
      throw new Error(`Failed to check bet status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the token address associated with the vault
   * Returns fallback if not connected
   *
   * @returns Token contract address
   */
  async getTokenAddress(): Promise<string> {
    if (!walletService.isConnected()) {
      return FALLBACK_VALUES.TOKEN_ADDRESS;
    }

    try {
      return await this.privateProvider.getTokenAddress();
    } catch (error) {
      console.error('[VAULT] Failed to get token address:', error);
      throw new Error(`Failed to get token address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user bets
   * Requires wallet to be connected
   *
   * @returns Array of user bets
   */
  async getUserBets(): Promise<Bet[]> {
    if (!walletService.isConnected()) {
      throw new Error('Wallet must be connected to get user bets');
    }

    if (!this.privateProvider.getUserBets) {
      throw new Error('Get user bets operation not supported by current provider');
    }

    return await this.privateProvider.getUserBets();
  }

  /**
   * Get the vault contract address
   *
   * @returns Vault contract address
   */
  getContractAddress(): string {
    return this.contractAddress;
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

  /**
   * Check if private provider is available (wallet connected)
   * @deprecated Use isConnected() instead
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
export const vaultService = VaultService.getInstance();

/**
 * Default export for convenience
 */
export default vaultService;
