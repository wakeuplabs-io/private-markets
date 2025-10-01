import { AztecAddress, Contract } from "@aztec/aztec.js";
import { ensureWalletConnected } from "@/lib/wallet";
import { walletConnectionManager } from "@/lib/wallet/WalletConnectionManager";
import { TokenContract } from "@/lib/contracts/Token";
import type { ITokenProvider } from "./types";
import { FALLBACK_VALUES } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccount = any;

/**
 * Helper class to wrap Token contract with proper typing
 */
class Token {
  private contract: Contract;

  constructor(contract: Contract) {
    this.contract = contract;
  }

  static async at(address: AztecAddress, wallet: AnyAccount): Promise<Token> {
    const contract = await Contract.at(address, TokenContract.artifact, wallet);
    return new Token(contract);
  }

  get methods() {
    return this.contract.methods;
  }
}

/**
 * Private Token Provider
 *
 * Handles token contract interactions using the connected user's wallet.
 * This provider is used when a wallet is connected and provides:
 * - Private balance queries with user's permissions
 * - Transaction submissions through user's wallet
 * - Contract method calls authenticated by the user
 *
 * Context: PRIVATE (User's Connected Wallet)
 * Use case: Production environment with real user wallets
 */
export class PrivateTokenProvider implements ITokenProvider {
  private contract: Token | null = null;
  private contractAddress: string | null = null;

  /**
   * Timeout wrapper for long-running operations
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number = 120000): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs / 1000}s`)), timeoutMs)
    );
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Get or create token contract instance with connected wallet
   */
  async getContract(address: string): Promise<Token> {
    try {
      // Return cached contract if address matches
      if (this.contract && this.contractAddress === address) {
        return this.contract;
      }

      // Get connected wallet account
      const account = await ensureWalletConnected();
      const aztecAddress = AztecAddress.fromString(address);

      // Create contract instance with user's wallet
      this.contract = await Token.at(aztecAddress, account as AnyAccount);
      this.contractAddress = address;

      return this.contract;
    } catch (error) {
      console.error('[TOKEN:PRIVATE] Failed to get token contract:', error);
      throw new Error(`Failed to get token contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get token name using connected wallet
   * Calls public_get_name() method on the contract
   */
  async getTokenName(address: string): Promise<unknown> {
    try {
      const contract = await this.getContract(address);
      const account = await ensureWalletConnected();
      const from = AztecAddress.fromString(account.getAddress().toString());

      const name = await contract.methods.name().simulate({ from });
      return name;
    } catch (error) {
      console.error('[TOKEN:PRIVATE] Failed to get token name:', error);
      return FALLBACK_VALUES.TOKEN_NAME;
    }
  }

  /**
   * Get token symbol using connected wallet
   * Calls public_get_symbol() method on the contract
   */
  async getTokenSymbol(address: string): Promise<unknown> {
    try {
      const contract = await this.getContract(address);
      const account = await ensureWalletConnected();
      const from = AztecAddress.fromString(account.getAddress().toString());

      const symbol = await contract.methods.symbol().simulate({ from });
      return symbol;
    } catch (error) {
      console.error('[TOKEN:PRIVATE] Failed to get token symbol:', error);
      return FALLBACK_VALUES.TOKEN_SYMBOL;
    }
  }

  /**
   * Get token decimals using connected wallet
   * Calls public_get_decimals() method on the contract
   */
  async getTokenDecimals(address: string): Promise<number> {
    try {
      const contract = await this.getContract(address);
      const account = await ensureWalletConnected();
      const from = AztecAddress.fromString(account.getAddress().toString());

      const decimals = await contract.methods.decimals().simulate({ from });
      return Number(decimals);
    } catch (error) {
      console.error('[TOKEN:PRIVATE] Failed to get token decimals:', error);
      return FALLBACK_VALUES.TOKEN_DECIMALS;
    }
  }

  /**
   * Get private balance for an owner using connected wallet
   * Requires user wallet to have proper permissions
   * Uses timeout to prevent hanging on long operations
   */
  async getPrivateBalance(address: string, owner: AztecAddress): Promise<bigint> {
    try {
      const contract = await this.getContract(address);
      const account = await ensureWalletConnected();
      const from = AztecAddress.fromString(account.getAddress().toString());

      const balance = await this.withTimeout(
        contract.methods.balance_of_private(owner).simulate({ from }),
        120000
      );

      return BigInt(balance.toString());
    } catch (error) {
      console.error('[TOKEN:PRIVATE] Failed to get private balance:', error);
      return FALLBACK_VALUES.BALANCE;
    }
  }

  /**
   * Mint tokens to private balance
   * Submits transaction through wallet connection manager
   * This is a write operation that requires user approval
   */
  async mintToPrivate(address: string, recipient: AztecAddress, amount: bigint): Promise<string> {
    try {
      const contract = await this.getContract(address);
      const account = await ensureWalletConnected();
      const from = account.getAddress();

      console.log('[TOKEN:PRIVATE] Minting to private:', from.toString(), recipient.toString(), amount.toString());

      // Create transaction interaction - mint_to_private expects (from, to, amount)
      const interaction = contract.methods.mint_to_private(from, recipient, amount);

      console.log('[TOKEN:PRIVATE] Transaction interaction created:', interaction);

      // Submit through wallet connection manager (handles user approval)
      await walletConnectionManager.sendTransaction(interaction);

      return 'Transaction sent successfully';
    } catch (error) {
      console.error('[TOKEN:PRIVATE] Failed to mint to private:', error);
      throw new Error(`Failed to mint to private: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear cached contract and address
   */
  clearCache(): void {
    this.contract = null;
    this.contractAddress = null;
  }
}
