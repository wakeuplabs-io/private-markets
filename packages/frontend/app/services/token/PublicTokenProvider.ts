import { AztecAddress, type Wallet } from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { aztecService } from "@/services/aztecService";
import { TokenContract } from "@/lib/contracts/Token";
import type { ITokenProvider } from "./types";
import { FALLBACK_VALUES } from "./types";

/**
 * Public Token Provider (READ-ONLY)
 * Uses PXE test accounts. No write operations.
 */
export class PublicTokenProvider implements ITokenProvider {
  private contractCache = new Map<string, TokenContract>();
  private walletCache: Wallet | null = null;

  private async getWallet(): Promise<Wallet> {
    try {
      if (this.walletCache) return this.walletCache;

      const pxe = await aztecService.getPXEClient();
      if (!pxe) throw new Error(aztecService.getUserFriendlyErrorMessage());

      const [wallet] = await getInitialTestAccountsWallets(pxe);
      this.walletCache = wallet;
      return wallet;
    } catch (error) {
      console.error('[TOKEN:PUBLIC] Failed to get PXE wallet:', error);
      throw new Error(`Failed to get PXE wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getContract(address: string): Promise<TokenContract> {
    try {
      if (this.contractCache.has(address)) {
        return this.contractCache.get(address)!;
      }

      const wallet = await this.getWallet();
      const aztecAddress = AztecAddress.fromString(address);
      const contract = await TokenContract.at(aztecAddress, wallet);
      this.contractCache.set(address, contract);
      return contract;
    } catch (error) {
      console.error('[TOKEN:PUBLIC] Failed to get token contract:', error);
      throw new Error(`Failed to get token contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTokenName(address: string): Promise<unknown> {
    try {
      const contract = await this.getContract(address);
      const wallet = await this.getWallet();
      const from = wallet.getAddress();

      const name = await contract.methods.name().simulate({ from });
      return name;
    } catch (error) {
      console.error('[TOKEN:PUBLIC] Failed to get token name:', error);
      return FALLBACK_VALUES.TOKEN_NAME;
    }
  }

  /**
   * Get token symbol using PXE test wallet
   * Calls symbol() method on the contract
   */
  async getTokenSymbol(address: string): Promise<unknown> {
    try {
      const contract = await this.getContract(address);
      const wallet = await this.getWallet();
      const from = wallet.getAddress();

      const symbol = await contract.methods.symbol().simulate({ from });
      return symbol;
    } catch (error) {
      console.error('[TOKEN:PUBLIC] Failed to get token symbol:', error);
      return FALLBACK_VALUES.TOKEN_SYMBOL;
    }
  }

  /**
   * Get token decimals using PXE test wallet
   * Calls decimals() method on the contract
   */
  async getTokenDecimals(address: string): Promise<number> {
    try {
      const contract = await this.getContract(address);
      const wallet = await this.getWallet();
      const from = wallet.getAddress();

      const decimals = await contract.methods.decimals().simulate({ from });
      return Number(decimals);
    } catch (error) {
      console.error('[TOKEN:PUBLIC] Failed to get token decimals:', error);
      return FALLBACK_VALUES.TOKEN_DECIMALS;
    }
  }

  /**
   * Get private balance for an owner using PXE test wallet
   * Note: This uses test account permissions, not user wallet permissions
   */
  async getPrivateBalance(address: string, owner: AztecAddress): Promise<bigint> {
    try {
      const contract = await this.getContract(address);
      const wallet = await this.getWallet();
      const from = wallet.getAddress();

      const balance = await contract.methods.balance_of_private(owner).simulate({ from });
      return balance;
    } catch (error) {
      console.error('[TOKEN:PUBLIC] Failed to get private balance:', error);
      return FALLBACK_VALUES.BALANCE;
    }
  }

  clearCache(): void {
    this.contractCache.clear();
    this.walletCache = null;
  }
}
