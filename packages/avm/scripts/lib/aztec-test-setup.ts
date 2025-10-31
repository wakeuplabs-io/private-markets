import { config } from "dotenv";
import { createAztecNodeClient, waitForNode, type AztecNode } from "@aztec/aztec.js/node";
import { createPXE, getPXEConfig, type PXE } from "@aztec/pxe/server";
import { BaseWallet, AccountManager } from "@aztec/aztec.js/wallet";
import { AccountWithSecretKey, type Account } from "@aztec/aztec.js/account";
import { getInitialTestAccountsData, type InitialAccountData } from "@aztec/accounts/testing";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ScriptTestWallet - Test wallet implementation for sandbox testing
 *
 * Extends BaseWallet to provide proper Wallet interface that AccountManager expects.
 * Similar to Aztec's official TestWallet but simplified for our use case.
 */
class ScriptTestWallet extends BaseWallet {
  private accounts: Map<string, Account> = new Map();

  constructor(pxe: PXE, node: AztecNode) {
    super(pxe, node);
  }

  /**
   * Required by BaseWallet - retrieves account by address
   */
  protected async getAccountFromAddress(address: AztecAddress): Promise<Account> {
    const account = this.accounts.get(address.toString());
    if (!account) {
      throw new Error(`Account not found in test wallet: ${address.toString()}`);
    }
    return account;
  }

  /**
   * Required by BaseWallet - returns all accounts with aliases
   */
  async getAccounts(): Promise<Array<{ alias: string; item: AztecAddress }>> {
    return Array.from(this.accounts.values()).map((acc, index) => ({
      alias: `test-account-${index}`,
      item: acc.getAddress()
    }));
  }

  /**
   * Load a sandbox pre-deployed account into this wallet
   *
   * @param data - Account data from getInitialTestAccountsData()
   * @returns AccountWalletWithSecretKey ready to use
   */
  async loadSandboxAccount(data: InitialAccountData): Promise<AccountWithSecretKey> {
    const accountContract = new SchnorrAccountContract(data.signingKey);

    // CRITICAL: Pass "this" (ScriptTestWallet) which has getChainInfo() from BaseWallet
    const accountManager = await AccountManager.create(
      this,  // ← Now this IS a proper Wallet with getChainInfo()
      data.secret,
      accountContract,
      data.salt
    );

    // Register the account contract with PXE (with secret key for private state)
    const instance = accountManager.getInstance();
    const artifact = await accountContract.getContractArtifact();
    await this.registerContract(instance, artifact, data.secret);

    // Get the account wallet
    const account = await accountManager.getAccount();
    this.accounts.set(accountManager.address.toString(), account);

    console.log(`   Loaded: ${accountManager.address.toString()}`);

    return account;
  }
}

/**
 * AztecTestSetup - Setup for sandbox testing with pre-loaded accounts
 *
 * Uses Aztec sandbox's pre-loaded test accounts (alice, bob, carl) for fast testing.
 * No account deployment needed, no keys management.
 *
 * Contract addresses are saved to: deployments/sandbox-test/contracts.json
 */

export interface ContractAddresses {
  [contractName: string]: string;
}

export interface TestAccounts {
  alice: AccountWithSecretKey;
  bob: AccountWithSecretKey;
  carl: AccountWithSecretKey;
}

export class AztecTestSetup {
  private node: AztecNode | null = null;
  private pxe: PXE | null = null;
  private wallet: ScriptTestWallet | null = null;
  private accounts: TestAccounts | null = null;
  private nodeUrl: string;
  private deploymentsDir: string;
  private contractsFile: string;

  constructor() {
    this.nodeUrl = process.env.NODE_URL || "http://localhost:8080";
    this.deploymentsDir = path.join(__dirname, "../../deployments/sandbox-test");
    this.contractsFile = path.join(this.deploymentsDir, "contracts.json");

    console.log("🧪 Aztec Test Setup (Sandbox Mode)");
    console.log(`   NODE_URL: ${this.nodeUrl}`);
    console.log(`   Contracts will be saved to: ${this.contractsFile}`);
  }

  /**
   * Initialize the test environment
   * Connects to sandbox and loads pre-configured test accounts (alice, bob, carl)
   */
  async initialize(): Promise<TestAccounts> {
    if (this.accounts) {
      console.log("Already initialized");
      return this.accounts;
    }

    console.log("\nInitializing sandbox test environment...");

    // 1. Create and connect to Aztec Node
    this.node = createAztecNodeClient(this.nodeUrl);
    await waitForNode(this.node);
    console.log("✅ Connected to Aztec sandbox node");

    // 2. Create PXE (in-memory, no persistent storage for tests)
    const pxeConfig = Object.assign(getPXEConfig(), {
      proverEnabled: false,
      l2BlockPollingIntervalMS: 1000,
      l2StartingBlock: 1,
    });

    this.pxe = await createPXE(this.node, pxeConfig);
    console.log("✅ PXE initialized (in-memory)");

    // 3. Create ScriptTestWallet (extends BaseWallet with getChainInfo())
    this.wallet = new ScriptTestWallet(this.pxe, this.node);
    console.log("✅ ScriptTestWallet created");

    // 4. Get sandbox pre-loaded test accounts data
    console.log("📝 Loading sandbox test accounts (alice, bob, carl)...");
    const accountsData = await getInitialTestAccountsData();

    if (accountsData.length < 3) {
      throw new Error("Sandbox should provide at least 3 test accounts");
    }

    // 5. Load each account into the wallet
    const alice = await this.wallet.loadSandboxAccount(accountsData[0]);
    const bob = await this.wallet.loadSandboxAccount(accountsData[1]);
    const carl = await this.wallet.loadSandboxAccount(accountsData[2]);

    this.accounts = { alice, bob, carl };

    console.log("✅ Test accounts loaded:");
    console.log(`   Alice: ${alice.getAddress().toString()}`);
    console.log(`   Bob:   ${bob.getAddress().toString()}`);
    console.log(`   Carl:  ${carl.getAddress().toString()}`);

    return this.accounts;
  }

  /**
   * Get the test accounts (alice, bob, carl)
   * @throws Error if initialize() hasn't been called
   */
  getAccounts(): TestAccounts {
    if (!this.accounts) {
      throw new Error("Test environment not initialized. Call initialize() first");
    }
    return this.accounts;
  }

  /**
   * Get the wallet instance (ScriptTestWallet with all accounts loaded)
   * @throws Error if initialize() hasn't been called
   */
  getWallet(): ScriptTestWallet {
    if (!this.wallet) {
      throw new Error("Wallet not initialized. Call initialize() first");
    }
    return this.wallet;
  }

  /**
   * Get the PXE instance
   * @throws Error if initialize() hasn't been called
   */
  getPXE(): PXE {
    if (!this.pxe) {
      throw new Error("PXE not initialized. Call initialize() first");
    }
    return this.pxe;
  }

  /**
   * Get the Node client instance
   * @throws Error if initialize() hasn't been called
   */
  getNode(): AztecNode {
    if (!this.node) {
      throw new Error("Node not initialized. Call initialize() first");
    }
    return this.node;
  }

  private ensureDeploymentsDir(): void {
    if (!fs.existsSync(this.deploymentsDir)) {
      fs.mkdirSync(this.deploymentsDir, { recursive: true });
    }
  }

  /**
   * Save a deployed contract address
   */
  saveContractAddress(contractName: string, address: string): void {
    this.ensureDeploymentsDir();

    let allContracts: ContractAddresses = {};
    if (fs.existsSync(this.contractsFile)) {
      allContracts = JSON.parse(fs.readFileSync(this.contractsFile, "utf8"));
    }

    allContracts[contractName] = address;
    fs.writeFileSync(this.contractsFile, JSON.stringify(allContracts, null, 2));
    console.log(`💾 Saved contract "${contractName}" to ${this.contractsFile}`);
  }

  /**
   * Load a contract address
   */
  loadContractAddress(contractName: string): string | null {
    if (!fs.existsSync(this.contractsFile)) return null;

    const allContracts: ContractAddresses = JSON.parse(
      fs.readFileSync(this.contractsFile, "utf8")
    );
    return allContracts[contractName] || null;
  }

  /**
   * Clear all saved contracts
   */
  clearContracts(): void {
    if (fs.existsSync(this.contractsFile)) {
      fs.unlinkSync(this.contractsFile);
      console.log("🗑️  Cleared all saved contracts");
    }
  }
}

export const aztecTestSetup = new AztecTestSetup();
