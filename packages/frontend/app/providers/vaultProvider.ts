import { AztecAddress, Fr, createPXEClient, computeAuthWitMessageHash } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { Contract } from "@nemi-fi/wallet-sdk/eip1193";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { ensureWalletConnected } from "../lib/walletSdk";
import { BetVaultContract } from "@/lib/contracts/BetVault";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccount = any;

interface WalletAccount {
  getAddress(): { toString(): string };
  setPublicAuthWit(messageHashOrIntent: any, authorized: boolean, options?: any): Promise<any>;
  aztecNode: any;
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

class Token extends Contract.fromAztec(TokenContract) {}
class BetVault extends Contract.fromAztec(BetVaultContract) {}

export class WalletSdkVaultProvider implements IVaultProvider {
  private vaultContract: BetVault | null = null;

  constructor(private contractAddress: string) {}

  private async getVaultContract(): Promise<BetVault> {
    if (this.vaultContract) {
      return this.vaultContract;
    }

    const account = await ensureWalletConnected();
    const address = AztecAddress.fromString(this.contractAddress);
    this.vaultContract = await BetVault.at(address, account as AnyAccount);

    return this.vaultContract;
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
      const account = await ensureWalletConnected() as WalletAccount;

      const userAddress = account.getAddress();

      // Create the token contract for authorization witness
      const tokenContract = await Token.at(
        AztecAddress.fromString(params.tokenAddress),
        account as AnyAccount
      );

      // Create the action for the authorization witness
      const action = tokenContract.methods.transfer_in_private(
        AztecAddress.fromString(userAddress.toString()),
        AztecAddress.fromString(this.contractAddress),
        BigInt(params.amount),
        Fr.fromString(params.authwitNonce)
      );

      // Create intent for authorization witness
      const intent = {
        caller: AztecAddress.fromString(this.contractAddress),
        action: {
          to: AztecAddress.fromString(params.tokenAddress),
          selector: action.request().functionCall.selector,
          args: action.request().functionCall.args
        }
      };

      // Get chain ID and version for message hash computation
      const chainId = new Fr(await account.aztecNode.getChainId());
      const version = new Fr(await account.aztecNode.getVersion());

      // Compute the message hash
      const messageHash = await computeAuthWitMessageHash(intent, {
        chainId,
        version
      });

      await account.setPublicAuthWit(messageHash, true);
      const tx = await vaultContract.methods
        .bet(
          Fr.fromString(params.marketId),
          params.outcome,
          params.amount,
          Fr.fromString(params.commitment),
          Fr.fromString(params.betId),
          Fr.fromString(params.authwitNonce),
          AztecAddress.fromString(userAddress.toString()),
          params.msg
        )
        .send()
        .wait();

      const txHash = tx.txHash.toString();
      return txHash;

    } catch (error) {
      console.error('[VAULT] Error placing bet:', error);
      throw new Error(`Failed to place bet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isProcessed(betId: string): Promise<boolean> {
    try {
      const contract = await this.getVaultContract();
      const result = await contract.methods
        .is_processed(Fr.fromString(betId))
        .simulate();

      return Boolean(result);
    } catch (error) {
      console.error('[VAULT] Error checking bet status:', error);
      throw new Error(`Failed to check bet status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTokenAddress(): Promise<string> {
    try {
      const contract = await this.getVaultContract();
      const result = await contract.methods
        .get_token_address()
        .simulate();

      const tokenAddress = result.toString();
      return tokenAddress;
    } catch (error) {
      console.error('[VAULT] Error getting token address:', error);
      throw new Error(`Failed to get token address: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      .send({ authWitnesses: [authwit] })
      .wait();

    return tx.txHash.toString();
  }

  async isProcessed(betId: string): Promise<boolean> {
    const pxe = createPXEClient(process.env.NEXT_PUBLIC_PXE_URL || "http://localhost:8080");
    const [wallet] = await getInitialTestAccountsWallets(pxe);

    const contract = await BetVaultContract.at(
      AztecAddress.fromString(this.contractAddress),
      wallet
    );

    const result = await contract.methods
      .is_processed(Fr.fromString(betId))
      .simulate();

    return result;
  }

  async getTokenAddress(): Promise<string> {
    const pxe = createPXEClient(process.env.NEXT_PUBLIC_PXE_URL || "http://localhost:8080");
    const [wallet] = await getInitialTestAccountsWallets(pxe);

    const contract = await BetVaultContract.at(
      AztecAddress.fromString(this.contractAddress),
      wallet
    );

    const result = await contract.methods
      .get_token_address()
      .simulate();

    return result.toString();
  }
}