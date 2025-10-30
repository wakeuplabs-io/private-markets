import { AztecAddress, Fr, Contract } from "@aztec/aztec.js";
import { CopyCatAccountWallet } from '@aztec/accounts/copy-cat/lazy';
import { TokenContract } from "@/lib/contracts/Token";
import { ensureWalletConnected } from "@/lib/wallet";
import { walletConnectionManager } from "@/lib/wallet/WalletConnectionManager";
import { BetVaultContract } from "@/lib/contracts/BetVault";
import { pxeService } from "@/services/pxeService";
import { pxeQueueService } from "@/services/pxeQueueService";
import type { IVaultProvider, BetParams, ClaimParams } from "./types";
import { FALLBACK_VALUES } from "./types";
import { Bet } from "@/types";
import { normalizeHex64 } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccount = any;

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
  placed_at: bigint;
  // Optional fields that might be added by the contract
  marketId?: string;
}

/**
 * Wallet account interface
 */
interface WalletAccount {
  getAddress(): { toString(): string };
  setPublicAuthWit(messageHashOrIntent: unknown, authorized: boolean, options?: unknown): Promise<unknown>;
  aztecNode: unknown;
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
  private contract: Contract | null = null;

  constructor(private contractAddress: string) {}

  /**
   * Get or create vault contract instance with connected wallet
   */
  async getContract(): Promise<Contract> {
    try {
      // Return cached contract if available
      if (this.contract) {
        return this.contract;
      }

      // Get connected wallet account
      const account = await ensureWalletConnected();
      const address = AztecAddress.fromString(this.contractAddress);

      // Create contract instance with user's wallet
      this.contract = await Contract.at(address, BetVaultContract.artifact, account as AnyAccount);

      return this.contract;
    } catch (error) {
      console.error('[VAULT:PRIVATE] Failed to get vault contract:', error);
      throw new Error(`Failed to get vault contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Place a bet on a market using connected wallet
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
      const vaultContract = await this.getContract();
      const account = await ensureWalletConnected() as WalletAccount;

      const fromAddress = AztecAddress.fromString(account.getAddress().toString());

      // Convert amount to e18 (wei equivalent for 18 decimals)
      const amountInE18 = BigInt(params.amount) * BigInt(10 ** 18);

      // Get admin address from vault contract (must match what the contract will use)
      const adminAddress = await vaultContract.methods.get_admin().simulate({ from: fromAddress });

      console.log('[VAULT:PRIVATE] Creating token authorization witness...');
      console.log('[VAULT:PRIVATE] Amount:', params.amount, '→', amountInE18.toString(), '(e18)');

      // Create token contract instance for authorization
      const tokenContract = await Contract.at(
        AztecAddress.fromString(params.tokenAddress),
        TokenContract.artifact,
        account as AnyAccount
      );

      // Create authorization action for token transfer (using e18 amount)
      const transferAction = tokenContract.methods.transfer_private_to_private(
        fromAddress,
        adminAddress,
        amountInE18,
        Fr.fromString(params.authwitNonce)
      );

      // Create authorization witness - vault contract will call the transfer
      const authwit = await (account as AnyAccount).createAuthWit({
        caller: AztecAddress.fromString(this.contractAddress),
        action: transferAction
      });

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
   * Uses CopyCatAccountWallet for proper simulation context
   *
   * @param betId - Bet ID to check
   * @returns true if bet has been processed, false otherwise
   */
  async isProcessed(betId: string): Promise<boolean> {
    return pxeQueueService.enqueue(async () => {
      try {
        const account = await ensureWalletConnected();
        const pxe = pxeService.getPXE();

        // Create CopyCat wallet for simulation
        const copyCatWallet = await CopyCatAccountWallet.create(pxe, account);
        const aztecAddress = AztecAddress.fromString(this.contractAddress);
        const contract = await Contract.at(aztecAddress, BetVaultContract.artifact, copyCatWallet);

        const result = await contract.methods
          .is_processed(Fr.fromString(betId))
          .simulate({
            from: account.getAddress(),
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
   * Uses CopyCatAccountWallet for proper simulation context
   *
   * @returns Token contract address
   */
  async getTokenAddress(): Promise<string> {
    return pxeQueueService.enqueue(async () => {
      try {
        const account = await ensureWalletConnected();
        const pxe = pxeService.getPXE();

        // Create CopyCat wallet for simulation
        const copyCatWallet = await CopyCatAccountWallet.create(pxe, account);
        const aztecAddress = AztecAddress.fromString(this.contractAddress);
        const contract = await Contract.at(aztecAddress, BetVaultContract.artifact, copyCatWallet);

        const result = await contract.methods
          .get_token_address()
          .simulate({
            from: account.getAddress(),
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
   * Uses CopyCatAccountWallet for proper simulation context
   */
  async getUserBets(): Promise<Bet[]> {
    return pxeQueueService.enqueue(async () => {
      const account = await ensureWalletConnected();
      const pxe = pxeService.getPXE();

      // Create CopyCat wallet for simulation
      const copyCatWallet = await CopyCatAccountWallet.create(pxe, account);
      const aztecAddress = AztecAddress.fromString(this.contractAddress);
      const contract = await Contract.at(aztecAddress, BetVaultContract.artifact, copyCatWallet);

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
        placedAt: blockchainBet.placed_at > 0 ? new Date(Number(blockchainBet.placed_at) * 1000) : new Date(),
        userAddress: normalizeHex64(blockchainBet.owner),
        commitment: normalizeHex64(blockchainBet.commitment),
        randomness: normalizeHex64(blockchainBet.randomness),
      }));

      return bets;
    });
  }

  /**
   * Authorize a claim for a bet using connected wallet
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
      const vaultContract = await this.getContract();
      const account = await ensureWalletConnected() as WalletAccount;
      const fromAddress = AztecAddress.fromString(account.getAddress().toString());

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
   */
  clearCache(): void {
    this.contract = null;
  }
}
