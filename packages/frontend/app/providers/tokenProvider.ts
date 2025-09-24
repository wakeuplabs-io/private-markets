import { AztecAddress, Contract, type Wallet } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { ensureWalletConnected } from "../lib/walletSdk";
import { aztecService } from "../services/aztecService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccount = any;

export interface ITokenProvider {
  getTokenName(): Promise<unknown>;
  getTokenSymbol(): Promise<unknown>;
  getTokenDecimals(): Promise<number>;
  getPrivateBalance(owner: AztecAddress): Promise<bigint>;
  mintToPrivate(recipient: AztecAddress, amount: bigint): Promise<string>;
}

class Token extends WalletSdkContract.fromAztec(TokenContract) {}

export class WalletSdkTokenProvider implements ITokenProvider {
  private tokenContract: Token | null = null;
  private pxeProvider: PXETokenProvider;

  constructor(private contractAddress: string) {
    // Create PXE provider as fallback for read operations
    this.pxeProvider = new PXETokenProvider(contractAddress);
  }

  // Helper method for adding timeout to any promise
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number = 120000): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs/1000}s`)), timeoutMs)
    );
    return Promise.race([promise, timeoutPromise]);
  }

  private async getTokenContract(): Promise<Token> {
    if (this.tokenContract) {
      return this.tokenContract;
    }

    const account = await ensureWalletConnected();
    const address = AztecAddress.fromString(this.contractAddress);
    this.tokenContract = await Token.at(address, account as AnyAccount);

    return this.tokenContract;
  }

  async getTokenName(): Promise<unknown> {
    try {
      const contract = await this.getTokenContract();
      const name = await contract.methods.public_get_name().simulate();
      return name;
    } catch (error) {
      console.warn('[TOKEN] WalletSDK failed for token name, using PXE fallback:', error);
      return await this.pxeProvider.getTokenName();
    }
  }

  async getTokenSymbol(): Promise<unknown> {
    try {
      const contract = await this.getTokenContract();
      const symbol = await contract.methods.public_get_symbol().simulate();
      return symbol;
    } catch (error) {
      console.warn('[TOKEN] WalletSDK failed for token symbol, using PXE fallback:', error);
      return await this.pxeProvider.getTokenSymbol();
    }
  }

  async getTokenDecimals(): Promise<number> {
    try {
      const contract = await this.getTokenContract();
      const decimals = await contract.methods.public_get_decimals().simulate();
      return Number(decimals);
    } catch (error) {
      console.warn('[TOKEN] WalletSDK failed for token decimals, using PXE fallback:', error);
      return await this.pxeProvider.getTokenDecimals();
    }
  }

  async getPrivateBalance(owner: AztecAddress): Promise<bigint> {
    try {
      const contract = await this.getTokenContract();
      const balance = await this.withTimeout(
        contract.methods.balance_of_private(owner).simulate(),
        120000
      );
      return BigInt(balance.toString());
    } catch (error) {
      console.warn('[TOKEN] WalletSDK failed for private balance, using PXE fallback:', error);
      return await this.pxeProvider.getPrivateBalance(owner);
    }
  }

  async mintToPrivate(recipient: AztecAddress, amount: bigint): Promise<string> {
    try {
      const contract = await this.getTokenContract();
      const account = await ensureWalletConnected();
      const from = account.getAddress();

      const tx = await contract.methods
        .mint_to_private(AztecAddress.fromString(from.toString()), recipient, amount)
        .send()
        .wait();

      const txHash = tx.txHash.toString();
      return txHash;
    } catch (error) {
      console.error('[TOKEN] Error minting to private:', error);
      throw new Error(`Failed to mint tokens to private: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  clearCache(): void {
    this.tokenContract = null;
    this.pxeProvider.clearCache();
  }
}

export class PXETokenProvider implements ITokenProvider {
  private contractCache = new Map<string, Contract>();
  private walletCache: Wallet | null = null;

  constructor(private contractAddress: string) {}

  private async getWallet(): Promise<Wallet> {
    if (this.walletCache) {
      return this.walletCache;
    }

    const pxe = await aztecService.getPXEClient();
    const [wallet] = await getInitialTestAccountsWallets(pxe);
    this.walletCache = wallet;
    return wallet;
  }

  private async getTokenContract(): Promise<Contract> {
    if (this.contractCache.has(this.contractAddress)) {
      return this.contractCache.get(this.contractAddress)!;
    }

    const wallet = await this.getWallet();
    const aztecAddress = AztecAddress.fromString(this.contractAddress);
    const contract = await Contract.at(aztecAddress, TokenContract.artifact, wallet);
    this.contractCache.set(this.contractAddress, contract);
    return contract;
  }

  async getTokenName(): Promise<unknown> {
    const contract = await this.getTokenContract();
    const name = await contract.methods.public_get_name().simulate();
    return name;
  }

  async getTokenSymbol(): Promise<unknown> {
    const contract = await this.getTokenContract();
    const symbol = await contract.methods.public_get_symbol().simulate();
    return symbol;
  }

  async getTokenDecimals(): Promise<number> {
    const contract = await this.getTokenContract();
    const decimals = await contract.methods.public_get_decimals().simulate();
    return Number(decimals);
  }

  async getPrivateBalance(owner: AztecAddress): Promise<bigint> {
    const contract = await this.getTokenContract();
    const balance = await contract.methods.balance_of_private(owner).simulate();
    return balance;
  }

  async mintToPrivate(recipient: AztecAddress, amount: bigint): Promise<string> {
    const contract = await this.getTokenContract();
    const wallet = await this.getWallet();
    const from = wallet.getAddress();
    const tx = await contract.methods
      .mint_to_private(from, recipient, amount)
      .send()
      .wait();
    return tx.txHash.toString();
  }

  clearCache(): void {
    this.contractCache.clear();
    this.walletCache = null;
  }
}