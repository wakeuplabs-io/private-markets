import { Contract, AztecAddress, type Wallet } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import type { TokenInfo, ITokenService } from "@/types/token";
import { aztecService } from "./aztecService";
import { fieldToString } from "@/lib/aztecUtils";

/**
 * Token service for interacting with Token contracts
 * Provides methods to read token information (name, symbol, decimals)
 */
class TokenService implements ITokenService {
  private static instance: TokenService;
  private contractCache = new Map<string, Contract>();
  private walletCache: Wallet | null = null;

  private constructor() {}

  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  private async getWallet(): Promise<Wallet> {
    if (this.walletCache) {
      return this.walletCache;
    }

    try {
      const pxe = await aztecService.getPXEClient();
      const [wallet] = await getInitialTestAccountsWallets(pxe);
      this.walletCache = wallet;
      return wallet;
    } catch (error) {
      console.error("Failed to get wallet:", error);
      throw new Error("Failed to create wallet for token interactions");
    }
  }

  private async getTokenContract(address: string): Promise<Contract> {
    if (this.contractCache.has(address)) {
      return this.contractCache.get(address)!;
    }

    try {
      const wallet = await this.getWallet();
      const aztecAddress = AztecAddress.fromString(address);

      const contract = await Contract.at(aztecAddress, TokenContract.artifact, wallet);

      this.contractCache.set(address, contract);

      return contract;
    } catch (error) {
      console.error("Failed to get token contract:", error);
      throw new Error(`Failed to connect to token contract at ${address}`);
    }
  }

  async getTokenInfo(address: string): Promise<TokenInfo> {
    try {
      const [name, symbol, decimals] = await Promise.all([
        this.getTokenName(address),
        this.getTokenSymbol(address),
        this.getTokenDecimals(address),
      ]);

      return {
        name,
        symbol,
        decimals,
        address: AztecAddress.fromString(address),
      };
    } catch (error) {
      console.error("Failed to get token info:", error);
      throw new Error(`Failed to fetch token information: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTokenName(address: string): Promise<string> {
    try {
      const contract = await this.getTokenContract(address);
      const name = await contract.methods.public_get_name().simulate();
      return fieldToString(name);
    } catch (error) {
      console.error("Failed to get token name:", error);
      throw new Error("Failed to fetch token name");
    }
  }

  async getTokenSymbol(address: string): Promise<string> {
    try {
      const contract = await this.getTokenContract(address);

      const symbol = await contract.methods.public_get_symbol().simulate();
      return fieldToString(symbol);
    } catch (error) {
      console.error("Failed to get token symbol:", error);
      throw new Error("Failed to fetch token symbol");
    }
  }

  async getTokenDecimals(address: string): Promise<number> {
    try {
      const contract = await this.getTokenContract(address);
      const decimals = await contract.methods.public_get_decimals().simulate();
      return Number(decimals);
    } catch (error) {
      console.error("Failed to get token decimals:", error);
      throw new Error("Failed to fetch token decimals");
    }
  }

  /**
   * Get private token balance for a specific owner
   */
  async getPrivateBalance(address: string, owner: AztecAddress): Promise<bigint> {
    try {
      const contract = await this.getTokenContract(address);
      const balance = await contract.methods.balance_of_private(owner).simulate();
      return balance;
    } catch (error) {
      console.error("Failed to get private balance:", error);
      throw new Error("Failed to fetch private token balance");
    }
  }

  /**
   * Mint tokens to private balance
   * @param address Token contract address
   * @param recipient Recipient's Aztec address
   * @param amount Amount to mint (in token's smallest unit)
   * @returns Transaction hash
   */
  async mintToPrivate(address: string, recipient: AztecAddress, amount: bigint): Promise<string> {
    try {
      const contract = await this.getTokenContract(address);
      const wallet = await this.getWallet();

      const from = wallet.getAddress();

      const tx = await contract.methods
        .mint_to_private(from, recipient, amount)
        .send()
        .wait();

      return tx.txHash.toString();
    } catch (error) {
      console.error("Failed to mint to private:", error);
      throw new Error(`Failed to mint tokens to private: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  clearCache(): void {
    this.contractCache.clear();
    this.walletCache = null;
  }

  isCached(address: string): boolean {
    return this.contractCache.has(address);
  }
}

export const tokenService = TokenService.getInstance();
export default tokenService;