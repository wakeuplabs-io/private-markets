import { AztecAddress, Fr, createPXEClient, Contract } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { ensureWalletConnected } from "@/lib/wallet";
import { BetVaultContract } from "@/lib/contracts/BetVault";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccount = any;

const FALLBACK_VALUES = {
  TOKEN_ADDRESS: "0x0000000000000000000000000000000000000000000000000000000000000000",
  BET_PROCESSED: false,
  ERROR_MESSAGE: "Data not available"
} as const;

interface WalletAccount {
  getAddress(): { toString(): string };
  setPublicAuthWit(messageHashOrIntent: unknown, authorized: boolean, options?: unknown): Promise<unknown>;
  aztecNode: unknown;
}

export interface IVaultProvider {
  placeBet(params: {
    marketId: string;
    outcome: number;
    amount: number;
    commitment: string;
    betId: string;
    authwitNonce: string;
    from: string;
    msg: number[][];
    tokenAddress: string;
  }): Promise<string>;
  isProcessed(betId: string): Promise<boolean>;
  getTokenAddress(): Promise<string>;
}

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

export class WalletSdkVaultProvider implements IVaultProvider {
  private vaultContract: BetVault | null = null;

  constructor(private contractAddress: string) {}

  private async getVaultContract(): Promise<BetVault | null> {
    try {
      if (this.vaultContract) {
        return this.vaultContract;
      }

      const account = await ensureWalletConnected();
      const address = AztecAddress.fromString(this.contractAddress);
      this.vaultContract = await BetVault.at(address, account as AnyAccount);

      return this.vaultContract;
    } catch (error) {
      console.error('[VAULT] WalletSDK failed to get vault contract:', error);
      return null;
    }
  }

  async placeBet(params: {
    marketId: string;
    outcome: number;
    amount: number;
    commitment: string;
    betId: string;
    authwitNonce: string;
    from: string;
    msg: number[][];
    tokenAddress: string;
  }): Promise<string> {
    try {
      const vaultContract = await this.getVaultContract();
      if (!vaultContract) {
        throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: Could not get vault contract`);
      }
      const account = await ensureWalletConnected() as WalletAccount;

      const userAddress = account.getAddress();

      const tokenContract = await Token.at(
        AztecAddress.fromString(params.tokenAddress),
        account as AnyAccount
      );

      const action = tokenContract.methods.transfer_in_private(
        AztecAddress.fromString(userAddress.toString()),
        AztecAddress.fromString(this.contractAddress),
        BigInt(params.amount),
        Fr.fromString(params.authwitNonce)
      );

      const authwit = await (account as AnyAccount).createAuthWit({
        caller: AztecAddress.fromString(this.contractAddress),
        action: action
      });
      const fromAddress = AztecAddress.fromString(userAddress.toString());
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
      return txHash;

    } catch (error) {
      console.error('[VAULT] Error placing bet:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('has not been registered in the wallet\'s PXE')) {
        throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: Contract not registered in wallet PXE`);
      }
      throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: ${errorMsg}`);
    }
  }

  async isProcessed(betId: string): Promise<boolean> {
    try {
      const contract = await this.getVaultContract();
      if (!contract) {
        return FALLBACK_VALUES.BET_PROCESSED;
      }
      const account = await ensureWalletConnected();
      const from = AztecAddress.fromString(account.getAddress().toString());
      const result = await contract.methods
        .is_processed(Fr.fromString(betId))
        .simulate({ from });

      return Boolean(result);
    } catch (error) {
      console.error('[VAULT] Error checking bet status:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('has not been registered in the wallet\'s PXE')) {
        console.warn('[VAULT] Contract not registered in PXE, returning fallback value');
        return FALLBACK_VALUES.BET_PROCESSED;
      }
      return FALLBACK_VALUES.BET_PROCESSED;
    }
  }

  async getTokenAddress(): Promise<string> {
    try {
      const contract = await this.getVaultContract();
      if (!contract) {
        return FALLBACK_VALUES.TOKEN_ADDRESS;
      }
      const account = await ensureWalletConnected();
      const from = AztecAddress.fromString(account.getAddress().toString());
      const result = await contract.methods
        .get_token_address()
        .simulate({ from });

      const tokenAddress = result.toString();
      return tokenAddress;
    } catch (error) {
      console.error('[VAULT] Error getting token address:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('has not been registered in the wallet\'s PXE')) {
        console.warn('[VAULT] Contract not registered in PXE, returning fallback value');
        return FALLBACK_VALUES.TOKEN_ADDRESS;
      }
      return FALLBACK_VALUES.TOKEN_ADDRESS;
    }
  }

  clearCache(): void {
    this.vaultContract = null;
  }
}

export class PXEVaultProvider implements IVaultProvider {
  private contractAddress: string;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;
  }

  async placeBet(params: {
    marketId: string;
    outcome: number;
    amount: number;
    commitment: string;
    betId: string;
    authwitNonce: string;
    from: string;
    msg: number[][];
    tokenAddress: string;
  }): Promise<string> {
    try {
      const pxe = createPXEClient(process.env.NEXT_PUBLIC_PXE_URL || "http://localhost:8080");
      const [wallet] = await getInitialTestAccountsWallets(pxe);

      const userAddress = wallet.getAddress();

      const { TokenContract } = await import("@aztec/noir-contracts.js/Token");

      const tokenContract = await TokenContract.at(
        AztecAddress.fromString(params.tokenAddress),
        wallet
      );

      const action = tokenContract.methods.transfer_in_private(
        userAddress,
        AztecAddress.fromString(this.contractAddress),
        BigInt(params.amount),
        Fr.fromString(params.authwitNonce)
      );

      const authwit = await wallet.createAuthWit({
        caller: AztecAddress.fromString(this.contractAddress),
        action: action
      });

      const contract = await BetVaultContract.at(
        AztecAddress.fromString(this.contractAddress),
        wallet
      );

      const tx = await contract.methods
        .bet(
          Fr.fromString(params.marketId),
          params.outcome,
          params.amount,
          Fr.fromString(params.commitment),
          Fr.fromString(params.betId),
          Fr.fromString(params.authwitNonce),
          userAddress,
          params.msg
        )
        .send({ 
          from: userAddress,
          authWitnesses: [authwit] 
        })
        .wait();

      return tx.txHash.toString();
    } catch (error) {
      console.error('[VAULT] PXE Error placing bet:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('has not been registered in the wallet\'s PXE')) {
        throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: Contract not registered in PXE`);
      }
      throw new Error(`${FALLBACK_VALUES.ERROR_MESSAGE}: ${errorMsg}`);
    }
  }

  async isProcessed(betId: string): Promise<boolean> {
    try {
      const pxe = createPXEClient(process.env.NEXT_PUBLIC_PXE_URL || "http://localhost:8080");
      const [wallet] = await getInitialTestAccountsWallets(pxe);

      const contract = await BetVaultContract.at(
        AztecAddress.fromString(this.contractAddress),
        wallet
      );

      const result = await contract.methods
        .is_processed(Fr.fromString(betId))
        .simulate({ from: wallet.getAddress() });

      return result;
    } catch (error) {
      console.error('[VAULT] PXE Error checking bet status:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('has not been registered in the wallet\'s PXE')) {
        console.warn('[VAULT] Contract not registered in PXE, returning fallback value');
      }
      return FALLBACK_VALUES.BET_PROCESSED;
    }
  }

  async getTokenAddress(): Promise<string> {
    try {
      const pxe = createPXEClient(process.env.NEXT_PUBLIC_PXE_URL || "http://localhost:8080");
      const [wallet] = await getInitialTestAccountsWallets(pxe);

      const contract = await BetVaultContract.at(
        AztecAddress.fromString(this.contractAddress),
        wallet
      );

      const result = await contract.methods
        .get_token_address()
        .simulate({ from: wallet.getAddress() });

      return result.toString();
    } catch (error) {
      console.error('[VAULT] PXE Error getting token address:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('has not been registered in the wallet\'s PXE')) {
        console.warn('[VAULT] Contract not registered in PXE, returning fallback value');
      }
      return FALLBACK_VALUES.TOKEN_ADDRESS;
    }
  }
}