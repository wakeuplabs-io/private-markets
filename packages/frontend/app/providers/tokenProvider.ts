import { Contract, AztecAddress, type Wallet } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { aztecService } from "../services/aztecService";
import type { AzguardClient } from "@azguardwallet/client";

export interface ITokenProvider {
  getTokenName(): Promise<unknown>;
  getTokenSymbol(): Promise<unknown>;
  getTokenDecimals(): Promise<number>;
  getPrivateBalance(owner: AztecAddress): Promise<bigint>;
  mintToPrivate(recipient: AztecAddress, amount: bigint): Promise<string>;
}

class AzguardTokenProvider implements ITokenProvider {
  private registrationPromise: Promise<void> | null = null;
  private isRegistered: boolean = false;

  constructor(
    private azguardClient: AzguardClient,
    private contractAddress: string
  ) {
    this.registrationPromise = this.registerContract();
  }

  private async registerContract(): Promise<void> {
    if (this.isRegistered) {
      return;
    }

    try {
      const [result] = await this.azguardClient.execute([
        {
          kind: "register_contract",
          chain: "aztec:31337",
          address: this.contractAddress,
        },
      ]);

      if (result.status !== "ok") {
        console.error("Contract registration failed:", result);
        throw new Error(`Contract registration failed: ${JSON.stringify(result)}`);
      }

      this.isRegistered = true;
    } catch (error) {
      console.error("Contract registration error:", error);
      this.isRegistered = false;
      throw error;
    }
  }

  private async ensureRegistered(): Promise<void> {
    if (this.registrationPromise) {
      try {
        await this.registrationPromise;
        this.registrationPromise = null;
      } catch (error) {
        console.warn("Initial registration failed, attempting re-registration:", error);
        this.registrationPromise = null;
        this.isRegistered = false;
      }
    }

    if (!this.isRegistered) {
      this.registrationPromise = this.registerContract();
      await this.registrationPromise;
      this.registrationPromise = null;
    }
  }

  private async simulateView(method: string, args: string[]): Promise<unknown> {
    await this.ensureRegistered();

    const account = this.azguardClient.accounts[0];
    const [result] = await this.azguardClient.execute([
      {
        kind: "simulate_views",
        account: account,
        calls: [
          {
            kind: "call",
            contract: this.contractAddress,
            method: method,
            args: args,
          },
        ],
      },
    ]);


    if (result.status !== "ok") {
      const errorMessage = result.status === "failed" ? result.error : "Operation was skipped";
      console.error(`${method} simulation failed:`, errorMessage);
      throw new Error(`Simulate ${method} failed: ${errorMessage}`);
    }

    const simulateResult = result.result as { decoded: unknown[] };
    return simulateResult.decoded[0];
  }

  private extractValue(result: unknown): string {
    if (result && typeof result === 'object' && 'value' in result) {
      return String((result as { value: string }).value);
    }
    return String(result || '');
  }

  async getTokenName(): Promise<unknown> {
    const name = await this.simulateView("public_get_name", []);
    const nameValue = this.extractValue(name);
    return BigInt(nameValue);
  }

  async getTokenSymbol(): Promise<unknown> {
    const symbol = await this.simulateView("public_get_symbol", []);
    const symbolValue = this.extractValue(symbol);
    return BigInt(symbolValue);
  }

  async getTokenDecimals(): Promise<number> {
    const decimals = await this.simulateView("public_get_decimals", []);
    return Number(this.extractValue(decimals));
  }

  async getPrivateBalance(owner: AztecAddress): Promise<bigint> {
    const balance = await this.simulateView("balance_of_private", [owner.toString()]);
    const balanceValue = this.extractValue(balance);
    return BigInt(balanceValue || '0');
  }

  async mintToPrivate(recipient: AztecAddress, amount: bigint): Promise<string> {
    const accounts = this.azguardClient.accounts;
    if (accounts.length === 0) {
      throw new Error("No accounts available in Azguard wallet");
    }

    const account = accounts[0];
    const fromAddress = account.split(":")[2];

    const [result] = await this.azguardClient.execute([
      {
        kind: "send_transaction",
        account: account,
        actions: [
          {
            kind: "call",
            contract: this.contractAddress,
            method: "mint_to_private",
            args: [fromAddress, recipient.toString(), amount.toString()],
          },
        ],
      },
    ]);

    if (result.status !== "ok") {
      const errorMessage = result.status === "failed" ? result.error : "Transaction was skipped";
      throw new Error(`Mint transaction failed: ${errorMessage}`);
    }

    return result.result as string;
  }
}

class PXETokenProvider implements ITokenProvider {
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

export { AzguardTokenProvider, PXETokenProvider };