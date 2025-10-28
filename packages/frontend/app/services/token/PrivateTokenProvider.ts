import { AztecAddress, Contract } from "@aztec/aztec.js";
import { CopyCatAccountWallet } from '@aztec/accounts/copy-cat/lazy';
import { ensureWalletConnected } from "@/lib/wallet";
import { walletConnectionManager } from "@/lib/wallet/WalletConnectionManager";
import { TokenContract } from "@/lib/contracts/Token";
import { pxeService } from "@/services/pxeService";
import { pxeQueueService } from "@/services/pxeQueueService";
import type { ITokenProvider } from "./types";
import { FALLBACK_VALUES } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccount = any;

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
  private contract: Contract | null = null;
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
  async getContract(address: string): Promise<Contract> {
    try {
      // Return cached contract if address matches
      if (this.contract && this.contractAddress === address) {
        return this.contract;
      }

      // Get connected wallet account
      const account = await ensureWalletConnected();
      const aztecAddress = AztecAddress.fromString(address);

      // Create contract instance with user's wallet
      this.contract = await Contract.at(aztecAddress, TokenContract.artifact, account as AnyAccount);
      this.contractAddress = address;

      return this.contract;
    } catch (error) {
      console.error('[TOKEN:PRIVATE] Failed to get token contract:', error);
      throw new Error(`Failed to get token contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get token name using connected wallet
   * Uses CopyCatAccountWallet for proper simulation context
   */
  async getTokenName(address: string): Promise<unknown> {
    return pxeQueueService.enqueue(async () => {
      try {
        const account = await ensureWalletConnected();
        const pxe = pxeService.getPXE();
        const copyCatWallet = await CopyCatAccountWallet.create(pxe, account);
        const aztecAddress = AztecAddress.fromString(address);
        const contract = await Contract.at(aztecAddress, TokenContract.artifact, copyCatWallet);

        const name = await contract.methods.name().simulate({
          from: account.getAddress(),
          skipFeeEnforcement: true
        });

        return name;
      } catch (error) {
        console.error('[TOKEN:PRIVATE] Failed to get token name:', error);
        return FALLBACK_VALUES.TOKEN_NAME;
      }
    });
  }

  /**
   * Get token symbol using connected wallet
   * Uses CopyCatAccountWallet for proper simulation context
   */
  async getTokenSymbol(address: string): Promise<unknown> {
    return pxeQueueService.enqueue(async () => {
      try {
        const account = await ensureWalletConnected();
        const pxe = pxeService.getPXE();
        const copyCatWallet = await CopyCatAccountWallet.create(pxe, account);
        const aztecAddress = AztecAddress.fromString(address);
        const contract = await Contract.at(aztecAddress, TokenContract.artifact, copyCatWallet);

        const symbol = await contract.methods.symbol().simulate({
          from: account.getAddress(),
          skipFeeEnforcement: true
        });

        return symbol;
      } catch (error) {
        console.error('[TOKEN:PRIVATE] Failed to get token symbol:', error);
        return FALLBACK_VALUES.TOKEN_SYMBOL;
      }
    });
  }

  /**
   * Get token decimals using connected wallet
   * Uses CopyCatAccountWallet for proper simulation context
   */
  async getTokenDecimals(address: string): Promise<number> {
    return pxeQueueService.enqueue(async () => {
      try {
        const account = await ensureWalletConnected();
        const pxe = pxeService.getPXE();
        const copyCatWallet = await CopyCatAccountWallet.create(pxe, account);
        const aztecAddress = AztecAddress.fromString(address);
        const contract = await Contract.at(aztecAddress, TokenContract.artifact, copyCatWallet);

        const decimals = await contract.methods.decimals().simulate({
          from: account.getAddress(),
          skipFeeEnforcement: true
        });
        return Number(decimals);
      } catch (error) {
        console.error('[TOKEN:PRIVATE] Failed to get token decimals:', error);
        return FALLBACK_VALUES.TOKEN_DECIMALS;
      }
    });
  }

  /**
   * Get private balance for an owner using connected wallet
   * Uses CopyCatAccountWallet for proper simulation context
   * Uses timeout to prevent hanging on long operations
   */
  async getPrivateBalance(address: string, owner: AztecAddress): Promise<bigint> {
    return pxeQueueService.enqueue(async () => {
      try {
        const account = await ensureWalletConnected();
        const pxe = pxeService.getPXE();
        const copyCatWallet = await CopyCatAccountWallet.create(pxe, account);
        const aztecAddress = AztecAddress.fromString(address);
        const contract = await Contract.at(aztecAddress, TokenContract.artifact, copyCatWallet);

        const balance = await this.withTimeout(
          contract.methods.balance_of_private(owner).simulate({
            from: account.getAddress(),
            skipFeeEnforcement: true
          }),
          120000
        );

        return BigInt(balance.toString());
      } catch (error) {
        console.error('[TOKEN:PRIVATE] Failed to get private balance:', error);
        return FALLBACK_VALUES.BALANCE;
      }
    });
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
      const interaction = contract.methods.mint_to_private(from, recipient, amount);
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
