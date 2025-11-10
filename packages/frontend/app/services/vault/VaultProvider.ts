import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Fr } from "@aztec/foundation/fields";
import { TokenContract } from "@/lib/contracts/Token";
import { ensureWalletConnected } from "@/lib/wallet";
import { walletConnectionManager } from "@/lib/wallet/walletConnectionManager";
import { BetVaultContract } from "@/lib/contracts/BetVault";
import { pxeQueueService } from "@/services/pxeQueueService";
import type { IVaultProvider, BetParams, ClaimParams } from "./types";
import { FALLBACK_VALUES } from "./types";
import { Bet } from "@/types";
import { normalizeHex64 } from "@/lib/utils";

/**
 * Blockchain bet structure (as returned from Aztec contract)
 * Uses snake_case and BigInt types
 */
interface BlockchainBet {
  owner: bigint;
  market_id: bigint;
  outcome: bigint;
  amount: bigint;
  bet_id: bigint;
  commitment: bigint;
  randomness: bigint;
  placed_at_block: bigint;
  // Optional fields that might be added by the contract
  marketId?: string;
}


/**
 * Vault Provider
 *
 * Handles vault contract interactions using the connected user's wallet.
 * This provider is used when a wallet is connected and provides:
 * - Private bet placement with user's authentication
 * - Transaction submissions through user's wallet
 * - Contract method calls authenticated by the user
 *
 * Context: User's Connected Wallet
 * Use case: Production environment with real user wallets
 */
export class VaultProvider implements IVaultProvider {
  constructor(private contractAddress: string) {}

  /**
   * Place a bet on a market using connected wallet
   * v3.0.0: Direct contract call with wallet
   *
   * This operation:
   * 1. Creates authorization witness for token transfer
   * 2. Submits bet transaction to vault contract
   * 3. Waits for transaction confirmation
   *
   * @param params - Bet parameters including market ID, outcome, amount, etc.
   * @returns Transaction hash
   */
  async placeBet(params: BetParams): Promise<string> {
    try {
      // Get connected wallet and account
      const wallet = await ensureWalletConnected();
      const account = walletConnectionManager.getAccount();
      const fromAddress = account.getAddress();

      // v3.0.0: Create vault contract instance with wallet (no caching)
      const aztecAddress = AztecAddress.fromString(this.contractAddress);
      const vaultContract = await BetVaultContract.at(aztecAddress, wallet);

      // Convert amount to e18 (wei equivalent for 18 decimals)
      const amountInE18 = BigInt(params.amount) * BigInt(10 ** 18);

      // Get admin address from vault contract (must match what the contract will use)
      const adminAddress = await vaultContract.methods.get_admin().simulate({
        from: fromAddress,
        skipFeeEnforcement: true
      });

      console.log('[VAULT:PRIVATE] Creating token authorization witness...');
      console.log('[VAULT:PRIVATE] Amount:', params.amount, '→', amountInE18.toString(), '(e18)');

      // v3.0.0: Create token contract instance with wallet
      const tokenContract = await TokenContract.at(
        AztecAddress.fromString(params.tokenAddress),
        wallet
      );

      // Create authorization action for token transfer (using e18 amount)
      const transferAction = tokenContract.methods.transfer_private_to_private(
        fromAddress,
        adminAddress,
        amountInE18,
        Fr.fromString(params.authwitNonce)
      );

      // v3.0.0: Create authorization witness with new signature
      // First param: authorizer (fromAddress)
      // Second param: { caller, action }
      const authwit = await wallet.createAuthWit(
        fromAddress,
        {
          caller: AztecAddress.fromString(this.contractAddress),
          action: transferAction
        }
      );

      console.log('[VAULT:PRIVATE] Submitting bet transaction...');

      const interaction = vaultContract.methods.bet(
        Fr.fromString(params.marketId),
        params.outcome,
        amountInE18,
        Fr.fromString(params.commitment),
        Fr.fromString(params.betId),
        Fr.fromString(params.authwitNonce),
        fromAddress,
      );
      await walletConnectionManager.sendTransaction(interaction, [authwit], fromAddress);
      return 'Transaction sent successfully';
    } catch (error) {
      console.error('[VAULT:PRIVATE] Failed to place bet:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      if (errorMsg.includes('has not been registered in the wallet\'s PXE')) {
        throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: Contract not registered in wallet PXE`);
      }

      throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: ${errorMsg}`);
    }
  }

  /**
   * Check if a bet has been processed
   * v3.0.0: Direct contract call with wallet
   * Wrapped with automatic retry on PXE sync errors
   *
   * @param betId - Bet ID to check
   * @returns true if bet has been processed, false otherwise
   */
  async isProcessed(betId: string): Promise<boolean> {
    return pxeQueueService.enqueue(async () => {
      try {
        const wallet = await ensureWalletConnected();
        const aztecAddress = AztecAddress.fromString(this.contractAddress);
        const contract = await BetVaultContract.at(aztecAddress, wallet);

        // v3.0.0: Always include 'from' parameter
        const account = walletConnectionManager.getAccount();
        const from = account.getAddress();

        const result = await contract.methods
          .is_processed(Fr.fromString(betId))
          .simulate({
            from,
            skipFeeEnforcement: true
          });

        return Boolean(result);
      } catch (error) {
        console.error('[VAULT:PRIVATE] Failed to check bet status:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        if (errorMsg.includes('has not been registered in the wallet\'s PXE')) {
          console.warn('[VAULT:PRIVATE] Contract not registered in PXE, returning fallback value');
          return FALLBACK_VALUES.BET_PROCESSED;
        }

        return FALLBACK_VALUES.BET_PROCESSED;
      }
    });
  }

  /**
   * Get the token address associated with the vault
   * v3.0.0: Direct contract call with wallet
   * Wrapped with automatic retry on PXE sync errors
   *
   * @returns Token contract address
   */
  async getTokenAddress(): Promise<string> {
    return pxeQueueService.enqueue(async () => {
      try {
        const wallet = await ensureWalletConnected();
        const aztecAddress = AztecAddress.fromString(this.contractAddress);
        const contract = await BetVaultContract.at(aztecAddress, wallet);

        // v3.0.0: Always include 'from' parameter
        const account = walletConnectionManager.getAccount();
        const from = account.getAddress();

        const result = await contract.methods
          .get_token_address()
          .simulate({
            from,
            skipFeeEnforcement: true
          });

        return result.toString();
      } catch (error) {
        console.error('[VAULT:PRIVATE] Failed to get token address:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        if (errorMsg.includes('has not been registered in the wallet\'s PXE')) {
          console.warn('[VAULT:PRIVATE] Contract not registered in PXE, returning fallback value');
          return FALLBACK_VALUES.TOKEN_ADDRESS;
        }

        return FALLBACK_VALUES.TOKEN_ADDRESS;
      }
    });
  }

  /**
   * Get user bets
   * v3.0.0: Direct contract call with wallet
   * Wrapped with automatic retry on PXE sync errors
   */
  async getUserBets(): Promise<Bet[]> {
    return pxeQueueService.enqueue(async () => {
      const wallet = await ensureWalletConnected();
      const aztecAddress = AztecAddress.fromString(this.contractAddress);
      const contract = await BetVaultContract.at(aztecAddress, wallet);

      // v3.0.0: Always include 'from' parameter
      const account = walletConnectionManager.getAccount();
      const from = account.getAddress();

      const result: { storage: BlockchainBet[], len: bigint } = await contract.methods
        .get_user_bets(from, 0, 10)
        .simulate({
          from,
          skipFeeEnforcement: true
        });

      const validBetsCount = Number(result.len);
      const blockchainBets = result.storage.slice(0, validBetsCount);

      const claimedStatuses = await Promise.all(
        blockchainBets.map(bet =>
          contract.methods
            .is_commitment_claimed(Fr.fromString('0x' + bet.commitment.toString(16)))
            .simulate({ from, skipFeeEnforcement: true })
        )
      );

      const bets: Bet[] = blockchainBets.map((blockchainBet, index) => ({
        id: normalizeHex64(blockchainBet.bet_id),
        marketId: blockchainBet.market_id.toString(),
        option: blockchainBet.outcome === BigInt(1) ? 'yes' : 'no',
        amount: Number(blockchainBet.amount) / 1e18,
        status: claimedStatuses[index] ? 'claimed' as const : 'confirmed' as const,
        placedAt: blockchainBet.placed_at_block > 0 ? new Date(Number(blockchainBet.placed_at_block) * 1000) : new Date(),
        userAddress: normalizeHex64(blockchainBet.owner),
        commitment: normalizeHex64(blockchainBet.commitment),
        randomness: normalizeHex64(blockchainBet.randomness),
      }));

      return bets;
    });
  }

  /**
   * Authorize a claim for a bet using connected wallet
   * v3.0.0: Direct contract call with wallet
   *
   * This operation:
   * 1. Verifies the commitment matches the secret
   * 2. Generates nullifier for the claim
   * 3. Sends Wormhole message to Arbitrum for payout
   *
   * Contract reference: packages/avm/vault/src/main.nr line 151-213
   *
   * @param params - Claim parameters including marketId, commitment, secret, recipient, betAmount
   * @returns Transaction hash
   */
  async authorizeClaim(params: ClaimParams): Promise<string> {
    try {
      const wallet = await ensureWalletConnected();
      const account = walletConnectionManager.getAccount();
      const fromAddress = account.getAddress();

      // v3.0.0: Create vault contract instance with wallet (no caching)
      const aztecAddress = AztecAddress.fromString(this.contractAddress);
      const vaultContract = await BetVaultContract.at(aztecAddress, wallet);

      console.log('[VAULT:PRIVATE] Authorizing claim...');
      console.log('[VAULT:PRIVATE] Market ID:', params.marketId);
      console.log('[VAULT:PRIVATE] Recipient:', params.recipient);
      console.log('[VAULT:PRIVATE] Bet Amount (normal):', params.betAmount);

      const betAmountWei = BigInt(params.betAmount) * BigInt(10 ** 18);

      console.log('[VAULT:PRIVATE] Bet Amount (wei):', betAmountWei.toString());

      const interaction = vaultContract.methods.authorizeClaim(
        Fr.fromString(params.marketId),
        Fr.fromString(params.commitment),
        Fr.fromString(params.secret),
        AztecAddress.fromString(params.recipient),
        betAmountWei,
        Fr.fromString(params.authwitNonce),
      );

      await walletConnectionManager.sendTransaction(interaction, [], fromAddress);

      return 'Claim authorization sent successfully';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      if (errorMsg.includes('has not been registered in the wallet\'s PXE')) {
        throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: Contract not registered in wallet PXE`);
      }

      if (errorMsg.includes('Invalid secret for commitment')) {
        throw new Error('Invalid secret for the provided commitment');
      }

      if (errorMsg.includes('No bet found for this commitment')) {
        throw new Error('No bet found with this commitment for the market');
      }

      throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: ${errorMsg}`);
    }
  }

  /**
   * Clear cached contract
   * v3.0.0: No caching - contracts created fresh each time
   */
  clearCache(): void {
    // No caching in v3.0.0
  }
}
