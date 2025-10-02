import { Bet } from "@/types";
import { walletService } from "../walletService";
import { PrivateVaultProvider } from "./PrivateVaultProvider";
import { PublicVaultProvider } from "./PublicVaultProvider";
import type { IVaultService, IVaultProvider, SimpleBetParams, BetParams } from "./types";

/**
 * Vault Service (Facade + Strategy Pattern)
 *
 * Orchestrates vault contract interactions by delegating to the appropriate provider
 * based on wallet connection status:
 *
 * - When wallet is connected → Uses PrivateVaultProvider (user's wallet)
 * - When wallet is disconnected → Uses PublicVaultProvider (PXE test accounts)
 *
 * This service acts as a facade that:
 * 1. Selects the appropriate provider strategy
 * 2. Delegates operations to the selected provider
 * 3. Handles parameter transformation (simplified API → full params)
 * 4. Provides a stable API regardless of underlying provider
 *
 * Benefits of this architecture:
 * - Single Responsibility: Each provider handles one context
 * - Open/Closed: Easy to add new providers without modifying service
 * - Dependency Inversion: Service depends on IVaultProvider abstraction
 * - Strategy Pattern: Runtime provider selection based on state
 */
export class VaultService implements IVaultService {
  private static instance: VaultService;

  private readonly privateProvider: IVaultProvider;
  private readonly publicProvider: IVaultProvider;
  private readonly contractAddress: string;

  /**
   * Private constructor for singleton pattern
   * Initializes both providers (dependency injection)
   */
  private constructor(
    contractAddress?: string,
    privateProvider?: IVaultProvider,
    publicProvider?: IVaultProvider
  ) {
    // Get contract address from environment
    this.contractAddress = contractAddress || process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS || "";

    if (!this.contractAddress) {
      throw new Error("NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS not configured");
    }

    // Allow dependency injection for testing
    this.privateProvider = privateProvider || new PrivateVaultProvider(this.contractAddress);
    this.publicProvider = publicProvider || new PublicVaultProvider(this.contractAddress);
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
   * Get active provider based on wallet connection status
   * Strategy selection happens here
   *
   * @returns PrivateVaultProvider if wallet is connected, PublicVaultProvider otherwise
   */
  private getProvider(): IVaultProvider {
    const isConnected = walletService.isConnected();
    return isConnected ? this.privateProvider : this.publicProvider;
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
    try {
      if (!walletService.isConnected()) {
        throw new Error('Wallet must be connected to place bets');
      }

      // Transform simplified params to full params
      const fullParams = await this.transformBetParams(params);

      // Delegate to active provider
      const provider = this.getProvider();
      if (!provider.placeBet) {
        throw new Error('Place bet operation not supported by current provider');
      }

      const txHash = await provider.placeBet(fullParams);

      return txHash;
    } catch (error) {
      console.error('[VAULT] Failed to place bet:', error);
      throw new Error(`Failed to place bet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a bet has been processed
   *
   * @param betId - Bet ID to check
   * @returns true if bet has been processed, false otherwise
   */
  async isBetProcessed(betId: string): Promise<boolean> {
    try {
      const provider = this.getProvider();
      return await provider.isProcessed(betId);
    } catch (error) {
      console.error('[VAULT] Failed to check bet status:', error);
      throw new Error(`Failed to check bet status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the token address associated with the vault
   *
   * @returns Token contract address
   */
  async getTokenAddress(): Promise<string> {
    try {
      const provider = this.getProvider();
      return await provider.getTokenAddress();
    } catch (error) {
      console.error('[VAULT] Failed to get token address:', error);
      throw new Error(`Failed to get token address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserBets(): Promise<Bet[]> {
    if (!walletService.isConnected()) {
      throw new Error('Wallet must be connected to get user bets');
    }
    const provider = this.getProvider();
    if (!provider.getUserBets) {
      throw new Error('Get user bets operation not supported by current provider');
    }
    return await provider.getUserBets();
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
   * Clear all provider caches
   * Useful when switching wallets or resetting state
   */
  clearCache(): void {
    this.privateProvider.clearCache();
    this.publicProvider.clearCache();
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
export const vaultService = VaultService.getInstance();

/**
 * Default export for convenience
 */
export default vaultService;
