import { AztecAddress, Fr, Contract } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { ensureWalletConnected } from "@/lib/wallet";
import { BetVaultContract } from "@/lib/contracts/BetVault";
import type { IVaultProvider, BetParams } from "./types";
import { FALLBACK_VALUES } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccount = any;

/**
 * Wallet account interface
 */
interface WalletAccount {
  getAddress(): { toString(): string };
  setPublicAuthWit(messageHashOrIntent: unknown, authorized: boolean, options?: unknown): Promise<unknown>;
  aztecNode: unknown;
}

/**
 * Helper class to wrap Token contract with proper typing
 */
class Token {
  private contract: Contract;

  constructor(contract: Contract) {
    this.contract = contract;
  }

  static async at(address: AztecAddress, wallet: AnyAccount): Promise<Token> {
    const { Contract } = await import("@aztec/aztec.js");
    const contract = await Contract.at(address, TokenContract.artifact, wallet);
    return new Token(contract);
  }

  get methods() {
    return this.contract.methods;
  }
}

/**
 * Helper class to wrap BetVault contract with proper typing
 */
class BetVault {
  private contract: Contract;

  constructor(contract: Contract) {
    this.contract = contract;
  }

  static async at(address: AztecAddress, wallet: AnyAccount): Promise<BetVault> {
    const { Contract } = await import("@aztec/aztec.js");
    const contract = await Contract.at(address, BetVaultContract.artifact, wallet);
    return new BetVault(contract);
  }

  get methods() {
    return this.contract.methods;
  }
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
  private contract: BetVault | null = null;

  constructor(private contractAddress: string) {}

  /**
   * Get or create vault contract instance with connected wallet
   */
  async getContract(): Promise<BetVault> {
    try {
      // Return cached contract if available
      if (this.contract) {
        return this.contract;
      }

      // Get connected wallet account
      const account = await ensureWalletConnected();
      const address = AztecAddress.fromString(this.contractAddress);

      // Create contract instance with user's wallet
      this.contract = await BetVault.at(address, account as AnyAccount);

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

      const userAddress = account.getAddress();

      console.log('[VAULT:PRIVATE] Creating token authorization witness...');

      // Create token contract instance for authorization
      const tokenContract = await Token.at(
        AztecAddress.fromString(params.tokenAddress),
        account as AnyAccount
      );

      // Create authorization action for token transfer
      const action = tokenContract.methods.transfer_in_private(
        AztecAddress.fromString(userAddress.toString()),
        AztecAddress.fromString(this.contractAddress),
        BigInt(params.amount),
        Fr.fromString(params.authwitNonce)
      );

      // Create authorization witness
      const authwit = await (account as AnyAccount).createAuthWit({
        caller: AztecAddress.fromString(this.contractAddress),
        action: action
      });

      console.log('[VAULT:PRIVATE] Submitting bet transaction...');

      const fromAddress = AztecAddress.fromString(userAddress.toString());

      // Submit bet transaction with authorization
      const tx = await vaultContract.methods
        .bet(
          Fr.fromString(params.marketId),
          params.outcome,
          params.amount,
          Fr.fromString(params.commitment),
          Fr.fromString(params.betId),
          Fr.fromString(params.authwitNonce),
          fromAddress,
          params.msg
        )
        .send({
          from: fromAddress,
          authWitnesses: [authwit]
        })
        .wait();

      const txHash = tx.txHash.toString();
      console.log('[VAULT:PRIVATE] Bet placed successfully:', txHash);

      return txHash;
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

  /**
   * Clear cached contract
   */
  clearCache(): void {
    this.contract = null;
  }
}
