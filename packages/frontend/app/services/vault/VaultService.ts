import { Bet } from "@/types";
import { walletService } from "../wallet/walletService";
import { VaultProvider } from "./VaultProvider";
import type { IVaultService, IVaultProvider, SimpleBetParams, BetParams, SimpleClaimParams, ClaimParams } from "./types";
import { FALLBACK_VALUES } from "./types";
import { generateCommitment, generateSecret, generateBetId, generateAuthwitNonce } from "@/utils/idGenerator";
import { betStorageService, type StoredBet } from "../storage/betStorageService";
import { normalizeHex64 } from "@/lib/utils";

/**
 * Vault Service (Facade Pattern)
 *
 * Orchestrates vault contract interactions by delegating to the appropriate provider
 * based on wallet connection status:
 *
 * - When wallet is connected → Uses VaultProvider (user's wallet)
 * - When wallet is disconnected → Returns FALLBACK_VALUES without errors
 *
 * This service acts as a facade that:
 * 1. Checks wallet connection status
 * 2. Delegates operations to VaultProvider if connected
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

  private readonly vaultProvider: IVaultProvider;
  private readonly contractAddress: string;

  /**
   * Private constructor for singleton pattern
   * Initializes provider (dependency injection)
   */
  private constructor(
    contractAddress?: string,
    vaultProvider?: IVaultProvider
  ) {
    // Get contract address from environment
    this.contractAddress = contractAddress || process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS || "";

    if (!this.contractAddress) {
      throw new Error("NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS not configured");
    }

    // Allow dependency injection for testing
    this.vaultProvider = vaultProvider || new VaultProvider(this.contractAddress);
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
    const secret = generateSecret();
    const marketIdBigInt = BigInt(params.marketId);
    const amountInWei = BigInt(params.amount) * BigInt(10 ** 18);
    const commitment = await generateCommitment(marketIdBigInt, amountInWei, secret);
    const betId = generateBetId();
    const authwitNonce = generateAuthwitNonce();
    const tokenAddress = await this.getTokenAddress();

    return {
      marketId: normalizeHex64(params.marketId),
      outcome: params.outcome,
      amount: params.amount,
      commitment: normalizeHex64(commitment),
      betId: normalizeHex64(betId),
      authwitNonce: normalizeHex64(authwitNonce),
      from: cleanedAddress,
      tokenAddress,
      secret: normalizeHex64(secret)
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
   * - Storing bet data in localStorage (with secret for claiming)
   *
   * @param params - Simplified bet parameters
   * @returns Transaction hash
   */
  async placeBet(params: SimpleBetParams): Promise<string> {
    if (!walletService.isConnected()) {
      throw new Error('Wallet must be connected to place bets');
    }

    try {
      const fullParams = await this.transformBetParams(params);

      if (!this.vaultProvider.placeBet) {
        throw new Error('Place bet operation not supported by current provider');
      }

      const result = await this.vaultProvider.placeBet(fullParams);
      const cleanedAddress = this.cleanAddress(params.userAddress);
      const betData: StoredBet = {
        marketId: fullParams.marketId,
        betId: fullParams.betId,
        commitment: fullParams.commitment,
        secret: fullParams.secret,
        amount: params.amount.toString(),
        outcome: params.outcome === 1, // Convert to boolean (true = yes, false = no)
        timestamp: Date.now(),
      };

      betStorageService.storeBet(cleanedAddress, betData);
      console.log('[VAULT] Bet stored in localStorage:', betData.betId);

      return result;
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
      return await this.vaultProvider.isProcessed(betId);
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
      return await this.vaultProvider.getTokenAddress();
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

    if (!this.vaultProvider.getUserBets) {
      throw new Error('Get user bets operation not supported by current provider');
    }

    return await this.vaultProvider.getUserBets();
  }

  /**
   * Authorize a claim for a bet
   * Requires wallet to be connected
   *
   * Automatically handles:
   * - Retrieval of bet from localStorage
   * - Secret and commitment verification
   * - Authorization nonce generation
   * - Deadline generation
   *
   * @param params - Simplified claim parameters
   * @returns Transaction hash
   */
  async authorizeClaim(params: SimpleClaimParams): Promise<string> {
    if (!walletService.isConnected()) {
      throw new Error('Wallet must be connected to authorize claims');
    }

    try {
      // Get connected wallet address
      const account = walletService.getAccount();
      if (!account) {
        throw new Error('No account found');
      }

      const userAddress = this.cleanAddress(account.getAddress().toString());

      // Retrieve bet from localStorage
      const storedBet = betStorageService.getBet(userAddress, params.betId);
      if (!storedBet) {
        throw new Error(`No bet found with ID ${params.betId} for this user. Make sure the bet was placed and stored locally.`);
      }

      // Verify market ID matches
      if (storedBet.marketId !== params.marketId) {
        throw new Error(`Market ID mismatch. Stored bet is for market ${storedBet.marketId}, but claim is for market ${params.marketId}`);
      }

      // Generate authorization nonce
      const authwitNonce = generateAuthwitNonce();

      // Create full claim params with normalized hex values
      // storedBet values are already normalized from placeBet, but authwitNonce needs normalization
      const fullParams: ClaimParams = {
        marketId: storedBet.marketId,
        commitment: storedBet.commitment,
        secret: storedBet.secret,
        recipient: params.recipient,
        authwitNonce: normalizeHex64(authwitNonce),
        betAmount: parseFloat(storedBet.amount),
      };

      if (!this.vaultProvider.authorizeClaim) {
        throw new Error('Authorize claim operation not supported by current provider');
      }

      const txHash = await this.vaultProvider.authorizeClaim(fullParams);

      return txHash;
    } catch (error) {
      throw new Error(`Failed to authorize claim: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

  /**
   * Clear any cached data
   * No-op for VaultService since it doesn't cache data
   */
  clearCache(): void {
    // VaultService doesn't maintain a cache
    // This method exists for interface compatibility
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
