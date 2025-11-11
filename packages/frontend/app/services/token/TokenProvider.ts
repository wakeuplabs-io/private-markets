import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { ensureWalletConnected } from "@/lib/wallet";
import { walletConnectionManager } from "@/lib/wallet/walletConnectionManager";
import { TokenContract } from "@/lib/contracts/Token";
import type { ITokenProvider } from "./types";
import { FALLBACK_VALUES } from "./types";
import { pxeManager } from "../pxe";

/**
 * Token Provider
 *
 * Handles token contract interactions using the connected user's wallet.
 * This provider is used when a wallet is connected and provides:
 * - Private balance queries with user's permissions
 * - Transaction submissions through user's wallet
 * - Contract method calls authenticated by the user
 *
 * Context: User's Connected Wallet
 * Use case: Production environment with real user wallets
 */
export class TokenProvider implements ITokenProvider {
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
   * Get token name using connected wallet
   * v3.0.0: Direct contract call with wallet
   */
  async getTokenName(address: string): Promise<unknown> {
    return pxeManager.enqueue(async () => {
      try {
        const wallet = await ensureWalletConnected();
        const aztecAddress = AztecAddress.fromString(address);
        const contract = await TokenContract.at(aztecAddress, wallet);
        const account = walletConnectionManager.getAccount();
        const from = account.getAddress();
        return await contract.methods.name().simulate({
          from,
        });
      } catch (error) {
        console.error('[TOKEN:PRIVATE] Failed to get token name:', error);
        return FALLBACK_VALUES.TOKEN_NAME;
      }
    }, 'Loading token name');
  }

  /**
   * Get token symbol using connected wallet
   */
  async getTokenSymbol(address: string): Promise<unknown> {
    return pxeManager.enqueue(async () => {
      try {
        const wallet = await ensureWalletConnected();
        const aztecAddress = AztecAddress.fromString(address);
        const contract = await TokenContract.at(aztecAddress, wallet);

        const account = walletConnectionManager.getAccount();
        const from = account.getAddress();

        return await contract.methods.symbol().simulate({
          from,
        });
      } catch (error) {
        console.error('[TOKEN:PRIVATE] Failed to get token symbol:', error);
        return FALLBACK_VALUES.TOKEN_SYMBOL;
      }
    }, 'Loading token symbol');
  }

  /**
   * Get token decimals using connected wallet
   */
  async getTokenDecimals(address: string): Promise<number> {
    return pxeManager.enqueue(async () => {
      try {
        const wallet = await ensureWalletConnected();
        const aztecAddress = AztecAddress.fromString(address);
        const contract = await TokenContract.at(aztecAddress, wallet);

        const account = walletConnectionManager.getAccount();
        const from = account.getAddress();

        const decimals = await contract.methods.decimals().simulate({
          from,
        });
        return Number(decimals);
      } catch (error) {
        console.error('[TOKEN:PRIVATE] Failed to get token decimals:', error);
        return FALLBACK_VALUES.TOKEN_DECIMALS;
      }
    }, 'Loading token decimals');
  }

  /**
   * Get private balance for an owner using connected wallet
   * Uses timeout to prevent hanging on long operations
   */
  async getPrivateBalance(address: string, owner: AztecAddress): Promise<bigint> {
    return pxeManager.enqueue(async () => {
      try {
        const wallet = await ensureWalletConnected();
        const aztecAddress = AztecAddress.fromString(address);
        const contract = await TokenContract.at(aztecAddress, wallet);

        const account = walletConnectionManager.getAccount();
        const from = account.getAddress();

        const balance = await this.withTimeout(
          contract.methods.balance_of_private(owner).simulate({
            from,
            skipFeeEnforcement: true
          }),
          120000
        );

        return BigInt(balance.toString());
      } catch (error) {
        console.error('[TOKEN:PRIVATE] Failed to get private balance:', error);
        return FALLBACK_VALUES.BALANCE;
      }
    }, 'Loading private balance');
  }

  /**
   * Mint tokens to private balance
   * v3.0.0: Only 2 parameters (recipient, amount)
   * Submits transaction through wallet connection manager
   * This is a write operation that requires user approval
   */
  async mintToPrivate(address: string, recipient: AztecAddress, amount: bigint): Promise<string> {
    return pxeManager.enqueue(async () => {
      try {
        const wallet = await ensureWalletConnected();
        const aztecAddress = AztecAddress.fromString(address);
        const contract = await TokenContract.at(aztecAddress, wallet);

        // v3.0.0: mint_to_private takes only 2 params (recipient, amount)
        const account = walletConnectionManager.getAccount();
        const from = account.getAddress();

        const interaction = contract.methods.mint_to_private(recipient, amount);
        await walletConnectionManager.sendTransaction(interaction, undefined, from);
        return 'Transaction sent successfully';
      } catch (error) {
        console.error('[TOKEN:PRIVATE] Failed to mint to private:', error);
        throw new Error(`Failed to mint to private: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, 'Minting tokens');
  }

  /**
   * Clear cached contract and address
   */
  clearCache(): void {
    // No caching in v3.0.0 - contracts created fresh each time
  }
}
