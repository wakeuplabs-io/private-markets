import { AztecAddress, Contract, type Wallet } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { ensureWalletConnected } from "@/lib/wallet";
import { aztecService } from "@/services/aztecService";
import { walletConnectionManager } from "@/lib/wallet/WalletConnectionManager";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccount = any;

const FALLBACK_VALUES = {
  TOKEN_NAME: "N/A",
  TOKEN_SYMBOL: "N/A", 
  TOKEN_DECIMALS: 18,
  BALANCE: BigInt(0),
  ERROR_MESSAGE: "Data not available"
} as const;

export interface ITokenProvider {
  getTokenName(): Promise<unknown>;
  getTokenSymbol(): Promise<unknown>;
  getTokenDecimals(): Promise<number>;
  getPrivateBalance(owner: AztecAddress): Promise<bigint>;
  mintToPrivate(recipient: AztecAddress, amount: bigint): Promise<string>;
}

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

export class WalletSdkTokenProvider implements ITokenProvider {
  private tokenContract: Token | null = null;
  private pxeProvider: PXETokenProvider;

  constructor(private contractAddress: string) {
    this.pxeProvider = new PXETokenProvider(contractAddress);
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number = 120000): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs/1000}s`)), timeoutMs)
    );
    return Promise.race([promise, timeoutPromise]);
  }

  private async getTokenContract(): Promise<Token | null> {
    try {
      if (this.tokenContract) {
        return this.tokenContract;
      }

      const account = await ensureWalletConnected();
      const address = AztecAddress.fromString(this.contractAddress);
      this.tokenContract = await Token.at(address, account as AnyAccount);

      return this.tokenContract;
    } catch (error) {
      console.error('[TOKEN] WalletSDK failed to get token contract:', error);
      return null;
    }
  }

  async getTokenName(): Promise<unknown> {
    try {
      const contract = await this.getTokenContract();
      if (!contract) {
        return FALLBACK_VALUES.TOKEN_NAME;
      }
      const account = await ensureWalletConnected();
      const from = AztecAddress.fromString(account.getAddress().toString());
      const name = await contract.methods.public_get_name().simulate({ from });
      return name;
    } catch (error) {
      console.warn('[TOKEN] WalletSDK failed for token name, trying PXE fallback:', error);
      try {
        return await this.pxeProvider.getTokenName();
      } catch (fallbackError) {
        console.error('[TOKEN] Both WalletSDK and PXE failed for token name:', fallbackError);
        return FALLBACK_VALUES.TOKEN_NAME;
      }
    }
  }

  async getTokenSymbol(): Promise<unknown> {
    try {
      const contract = await this.getTokenContract();
      if (!contract) {
        return FALLBACK_VALUES.TOKEN_SYMBOL;
      }
      const account = await ensureWalletConnected();
      const from = AztecAddress.fromString(account.getAddress().toString());
      const symbol = await contract.methods.public_get_symbol().simulate({ from });
      return symbol;
    } catch (error) {
      console.warn('[TOKEN] WalletSDK failed for token symbol, trying PXE fallback:', error);
      try {
        return await this.pxeProvider.getTokenSymbol();
      } catch (fallbackError) {
        console.error('[TOKEN] Both WalletSDK and PXE failed for token symbol:', fallbackError);
        return FALLBACK_VALUES.TOKEN_SYMBOL;
      }
    }
  }

  async getTokenDecimals(): Promise<number> {
    try {
      const contract = await this.getTokenContract();
      if (!contract) {
        return FALLBACK_VALUES.TOKEN_DECIMALS;
      }
      const account = await ensureWalletConnected();
      const from = AztecAddress.fromString(account.getAddress().toString());
      const decimals = await contract.methods.public_get_decimals().simulate({ from });
      return Number(decimals);
    } catch (error) {
      console.warn('[TOKEN] WalletSDK failed for token decimals, trying PXE fallback:', error);
      try {
        return await this.pxeProvider.getTokenDecimals();
      } catch (fallbackError) {
        console.error('[TOKEN] Both WalletSDK and PXE failed for token decimals:', fallbackError);
        return FALLBACK_VALUES.TOKEN_DECIMALS;
      }
    }
  }

  async getPrivateBalance(owner: AztecAddress): Promise<bigint> {
    try {
      const contract = await this.getTokenContract();
      if (!contract) {
        return FALLBACK_VALUES.BALANCE;
      }
      const account = await ensureWalletConnected();
      const from = AztecAddress.fromString(account.getAddress().toString());
      const balance = await this.withTimeout(
        contract.methods.balance_of_private(owner).simulate({ from }),
        120000
      );
      return BigInt(balance.toString());
    } catch (error) {
      console.warn('[TOKEN] WalletSDK failed for private balance, trying PXE fallback:', error);
      try {
        return await this.pxeProvider.getPrivateBalance(owner);
      } catch (fallbackError) {
        console.error('[TOKEN] Both WalletSDK and PXE failed for private balance:', fallbackError);
        return FALLBACK_VALUES.BALANCE;
      }
    }
  }

  async mintToPrivate(recipient: AztecAddress, amount: bigint): Promise<string> {
    try {
      const contract = await this.getTokenContract();
      if (!contract) {
        throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: Could not get contract`);
      }
      await ensureWalletConnected();

      console.log('[TOKEN] Minting to private:', recipient, amount);
      const interaction = contract.methods.mint_to_private(recipient, amount);
      console.log('[TOKEN] Minting to private:', interaction);
      await walletConnectionManager.sendTransaction(interaction);

      return 'Transaction sent successfully';
    } catch (error) {
      console.error('[TOKEN] Error minting to private:', error);
      throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  clearCache(): void {
    this.tokenContract = null;
    this.pxeProvider.clearCache();
  }
}

export class PXETokenProvider implements ITokenProvider {
  private contractCache = new Map<string, TokenContract>();
  private walletCache: Wallet | null = null;

  constructor(private contractAddress: string) {}

  private async getWallet(): Promise<Wallet | null> {
    try {
      if (this.walletCache) {
        return this.walletCache;
      }

      const pxe = await aztecService.getPXEClient();
      if (!pxe) {
        console.error('[TOKEN] PXE not available:', aztecService.getUserFriendlyErrorMessage());
        return null;
      }
      
      const [wallet] = await getInitialTestAccountsWallets(pxe);
      this.walletCache = wallet;
      return wallet;
    } catch (error) {
      console.error('[TOKEN] PXE failed to get wallet:', error);
      return null;
    }
  }

  private async getTokenContract(): Promise<TokenContract | null> {
    try {
      if (this.contractCache.has(this.contractAddress)) {
        return this.contractCache.get(this.contractAddress)!;
      }

      const wallet = await this.getWallet();
      if (!wallet) {
        return null;
      }

      const aztecAddress = AztecAddress.fromString(this.contractAddress);

      const contract = await TokenContract.at(aztecAddress, wallet);
      this.contractCache.set(this.contractAddress, contract);
      return contract;
    } catch (error) {
      console.error('[TOKEN] PXE failed to get token contract:', error);
      return null;
    }
  }

  async getTokenName(): Promise<unknown> {
    try {
      const contract = await this.getTokenContract();
      if (!contract) {
        return FALLBACK_VALUES.TOKEN_NAME;
      }
      const wallet = await this.getWallet();
      if (!wallet) {
        return FALLBACK_VALUES.TOKEN_NAME;
      }
      const from = wallet.getAddress();
      const name = await contract.methods.public_get_name().simulate({ from });
      return name;
    } catch (error) {
      console.error('[TOKEN] PXE failed for token name:', error);
      return FALLBACK_VALUES.TOKEN_NAME;
    }
  }

  async getTokenSymbol(): Promise<unknown> {
    try {
      const contract = await this.getTokenContract();
      if (!contract) {
        return FALLBACK_VALUES.TOKEN_SYMBOL;
      }
      const wallet = await this.getWallet();
      if (!wallet) {
        return FALLBACK_VALUES.TOKEN_SYMBOL;
      }
      const from = wallet.getAddress();
      const symbol = await contract.methods.public_get_symbol().simulate({ from });
      return symbol;
    } catch (error) {
      console.error('[TOKEN] PXE failed for token symbol:', error);
      return FALLBACK_VALUES.TOKEN_SYMBOL;
    }
  }

  async getTokenDecimals(): Promise<number> {
    try {
      const contract = await this.getTokenContract();
      if (!contract) {
        return FALLBACK_VALUES.TOKEN_DECIMALS;
      }
      const wallet = await this.getWallet();
      if (!wallet) {
        return FALLBACK_VALUES.TOKEN_DECIMALS;
      }
      const from = wallet.getAddress();
      const decimals = await contract.methods.public_get_decimals().simulate({ from });
      return Number(decimals);
    } catch (error) {
      console.error('[TOKEN] PXE failed for token decimals:', error);
      return FALLBACK_VALUES.TOKEN_DECIMALS;
    }
  }

  async getPrivateBalance(owner: AztecAddress): Promise<bigint> {
    try {
      const contract = await this.getTokenContract();
      if (!contract) {
        return FALLBACK_VALUES.BALANCE;
      }
      const wallet = await this.getWallet();
      if (!wallet) {
        return FALLBACK_VALUES.BALANCE;
      }
      const from = wallet.getAddress();
      const balance = await contract.methods.balance_of_private(owner).simulate({ from });
      return balance;
    } catch (error) {
      console.error('[TOKEN] PXE failed for private balance:', error);
      return FALLBACK_VALUES.BALANCE;
    }
  }

  async mintToPrivate(recipient: AztecAddress, amount: bigint): Promise<string> {
    try {
      const contract = await this.getTokenContract();
      if (!contract) {
        throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: Could not get contract`);
      }
      const wallet = await this.getWallet();
      if (!wallet) {
        throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: Could not get wallet`);
      }
      const from = wallet.getAddress();
      const tx = await contract.methods
        .mint_to_private(recipient, amount)
        .send({ from })
        .wait();
      return tx.txHash.toString();
    } catch (error) {
      console.error('[TOKEN] PXE failed for mint to private:', error);
      throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  clearCache(): void {
    this.contractCache.clear();
    this.walletCache = null;
  }
}