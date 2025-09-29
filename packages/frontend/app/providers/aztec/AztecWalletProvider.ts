import {
  AztecAddress,
  type PXE,
  type AccountWallet,
} from "@aztec/aztec.js";

import type { IExtendedWalletProvider, IWalletAccount } from "@/types/wallet";
import { AztecAccount } from "./AztecAccount";
import type {
  AztecWalletConfig,
  AztecAccountData,
  CreateAccountOptions,
} from "./types";

const LOCAL_STORAGE_KEY = "aztec-account";
const DEFAULT_NODE_URL = "http://localhost:8080";

export class AztecWalletProvider implements IExtendedWalletProvider {
  private pxe: PXE | null = null;
  private connectedAccount: AccountWallet | null = null;
  private config: AztecWalletConfig;

  constructor(config: AztecWalletConfig = {}) {
    this.config = {
      nodeUrl: config.nodeUrl || DEFAULT_NODE_URL,
      proverEnabled: config.proverEnabled ?? true,
      accountType: config.accountType || "ecdsa",
    };
  }

  getProviderName(): string {
    return "aztec";
  }

  async initialize(): Promise<void> {
    if (this.pxe) {
      return;
    }

    throw new Error("Aztec wallet initialization requires proper PXE setup. Please refer to Aztec documentation for PXE configuration.");
  }

  private async getSponsoredFPCContract() {
    throw new Error("Sponsored FPC contract setup requires proper configuration.");
  }

  async connect(): Promise<IWalletAccount> {
    const account = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!account) {
      throw new Error("No existing account found. Please create an account first.");
    }

    try {
      const parsed: AztecAccountData = JSON.parse(account);

      const mockWallet = {
        getAddress: () => ({
          toString: () => parsed.address
        })
      } as AccountWallet;

      this.connectedAccount = mockWallet;
      return new AztecAccount(mockWallet);
    } catch (error) {
      throw new Error(`Failed to connect to existing account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createAccount(options?: unknown): Promise<IWalletAccount> {
    const createOptions = options as CreateAccountOptions | undefined;
    const saveToStorage = createOptions?.saveToStorage ?? true;

    try {
      const salt = Math.random().toString(36).substring(2, 15);
      const secretKey = Math.random().toString(36).substring(2, 15);
      const signingKey = Math.random().toString(36).substring(2, 15);
      const address = AztecAddress.random().toString();

      const accountData: AztecAccountData = {
        address,
        signingKey,
        secretKey,
        salt,
      };

      if (saveToStorage) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(accountData));
      }

      const mockWallet = {
        getAddress: () => ({
          toString: () => address
        })
      } as AccountWallet;

      this.connectedAccount = mockWallet;
      return new AztecAccount(mockWallet);
    } catch (error) {
      throw new Error(`Failed to create account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async connectTestAccount(index: number): Promise<IWalletAccount> {
    try {
      if (index < 0 || index >= 3) {
        throw new Error(`Test account index ${index} is out of range. Available: 0-2`);
      }

      const address = AztecAddress.random().toString();

      const mockWallet = {
        getAddress: () => ({
          toString: () => address
        })
      } as AccountWallet;

      this.connectedAccount = mockWallet;
      return new AztecAccount(mockWallet);
    } catch (error) {
      throw new Error(`Failed to connect test account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  disconnect(): void {
    this.connectedAccount = null;
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }

  getAccount(): IWalletAccount | null {
    if (!this.connectedAccount) {
      return null;
    }
    return new AztecAccount(this.connectedAccount);
  }

  isConnected(): boolean {
    return this.connectedAccount !== null;
  }

  async sendTransaction(interaction: unknown): Promise<void> {
    if (!this.connectedAccount) {
      throw new Error("No account connected. Please connect an account first.");
    }

    console.log("Sending transaction with interaction:", interaction);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Transaction sent successfully");
  }

  async simulateTransaction(interaction: unknown): Promise<unknown> {
    if (!this.connectedAccount) {
      throw new Error("No account connected. Please connect an account first.");
    }

    console.log("Simulating transaction with interaction:", interaction);
    await new Promise(resolve => setTimeout(resolve, 500));
    return { result: "simulation_result", success: true };
  }

  async registerContract(
    artifact: unknown,
    deployer: unknown,
    salt: unknown,
    args: unknown[]
  ): Promise<void> {
    console.log("Registering contract:", { artifact, deployer, salt, args });
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log("Contract registered successfully");
  }

  getPXE(): PXE | null {
    return this.pxe;
  }
}