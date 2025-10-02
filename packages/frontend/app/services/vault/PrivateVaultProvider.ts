import { AztecAddress, Fr, Contract } from "@aztec/aztec.js";
import { TokenContract } from "@/lib/contracts/Token";
import { ensureWalletConnected } from "@/lib/wallet";
import { walletConnectionManager } from "@/lib/wallet/WalletConnectionManager";
import { BetVaultContract } from "@/lib/contracts/BetVault";
import type { IVaultProvider, BetParams } from "./types";
import { FALLBACK_VALUES } from "./types";
import { Bet } from "@/types";

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
 * Private Vault Provider
 *
 * Handles vault contract interactions using the connected user's wallet.
 * This provider is used when a wallet is connected and provides:
 * - Private bet placement with user's authentication
 * - Transaction submissions through user's wallet
 * - Contract method calls authenticated by the user
 *
 * Context: PRIVATE (User's Connected Wallet)
 * Use case: Production environment with real user wallets
 */
export class PrivateVaultProvider implements IVaultProvider {
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

      // OPTION 1: Using wallet connection manager (delegated approach)
      const interaction = vaultContract.methods.bet(
        Fr.fromString(params.marketId),
        params.outcome,
        amountInE18,
        Fr.fromString(params.commitment),
        Fr.fromString(params.betId),
        Fr.fromString(params.authwitNonce),
        fromAddress,
        params.msg
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
   *
   * @param betId - Bet ID to check
   * @returns true if bet has been processed, false otherwise
   */
  async isProcessed(betId: string): Promise<boolean> {
    try {
      const contract = await this.getContract();
      const account = await ensureWalletConnected();
      const from = AztecAddress.fromString(account.getAddress().toString());

      const result = await contract.methods
        .is_processed(Fr.fromString(betId))
        .simulate({ from });

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
  }

  /**
   * Get the token address associated with the vault
   *
   * @returns Token contract address
   */
  async getTokenAddress(): Promise<string> {
    try {
      const contract = await this.getContract();
      const account = await ensureWalletConnected();
      const from = AztecAddress.fromString(account.getAddress().toString());

      const result = await contract.methods
        .get_token_address()
        .simulate({ from });

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
  }

  async getUserBets(): Promise<Bet[]> {
    const contract = await this.getContract();
    const account = await ensureWalletConnected();
    const from = AztecAddress.fromString(account.getAddress().toString());

    const result: { storage: BlockchainBet[], len: bigint } = await contract.methods
      .getMyBets(from, 0, 10)
      .simulate({ from });

    const validBetsCount = Number(result.len);
    const blockchainBets = result.storage.slice(0, validBetsCount);

    // Transform blockchain format to application Bet format
    const bets: Bet[] = blockchainBets.map(blockchainBet => ({
      id: blockchainBet.bet_id.toString(),
      marketId: blockchainBet.market_id.toString(),
      option: blockchainBet.outcome === BigInt(1) ? 'yes' : 'no',
      amount: Number(blockchainBet.amount) / 1e18, // Convert from e18 to normal units
      status: 'confirmed' as const,
      placedAt: new Date(), // TODO: Get actual timestamp from blockchain
      // Optional fields that might come from blockchain
      userAddress: blockchainBet.owner.toString(),
    }));

    return bets;
  }

  /**
   * Clear cached contract
   */
  clearCache(): void {
    this.contract = null;
  }
}
