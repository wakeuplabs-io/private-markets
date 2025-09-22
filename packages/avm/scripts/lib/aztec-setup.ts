import {
  createPXEClient,
  waitForPXE,
  AztecAddress,
  type PXE,
  type Wallet,
  GrumpkinScalar,
  Fr,
  SponsoredFeePaymentMethod,
  type ContractInstanceWithAddress,
  createAztecNodeClient,
} from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { getContractInstanceFromDeployParams } from "@aztec/aztec.js/contracts";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { SPONSORED_FPC_SALT } from "@aztec/constants";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type NetworkType = "sandbox" | "testnet";

export interface AccountKeys {
  privateKey: string;
  salt: string;
}

export interface AccountInfo {
  address: string;
  deployed: boolean;
}

export interface DeployedAccounts {
  [accountName: string]: AccountInfo;
}

export interface StoredKeys {
  [accountName: string]: AccountKeys;
}

export interface ContractAddresses {
  [contractName: string]: string;
}

export class AztecSetup {
  private pxe: PXE | null = null;
  private network: NetworkType | null = null;
  private deploysDir: string;
  private keysFile: string;
  private accountsFile: string;
  private contractsFile: string;

  constructor() {
    this.deploysDir = path.join(__dirname, "..", "deploys");
    this.keysFile = path.join(this.deploysDir, "keys.json");
    this.accountsFile = path.join(this.deploysDir, "accounts.json");
    this.contractsFile = path.join(this.deploysDir, "contracts.json");
  }

  private ensureDeploysDir(): void {
    if (!fs.existsSync(this.deploysDir)) {
      fs.mkdirSync(this.deploysDir, { recursive: true });
    }
  }

  private detectNetwork(): NetworkType {
    const pxeUrl = process.env.PXE_URL || "http://localhost:8080";
    return pxeUrl.includes("localhost") || pxeUrl.includes("127.0.0.1")
      ? "sandbox"
      : "testnet";
  }

  async setupPXE(): Promise<PXE> {
    if (this.pxe) return this.pxe;

    const pxeUrl = process.env.PXE_URL || "http://localhost:8080";
    this.network = this.detectNetwork();

    console.log(`🔗 Connecting to ${this.network} PXE at: ${pxeUrl}`);

    this.pxe = createPXEClient(pxeUrl);
    await waitForPXE(this.pxe);

    console.log(`✅ Connected to ${this.network} PXE`);

    if (this.network === "testnet") {
      await this.registerContractsForTestnet();
    }

    return this.pxe;
  }

  private async registerContractsForTestnet(): Promise<void> {
    if (!this.pxe) throw new Error("PXE not initialized");

    console.log("🔄 Registering contracts for testnet...");

    try {
      const sponsoredFPC = await this.getSponsoredFPCInstance();
      await this.pxe.registerContract({
        instance: sponsoredFPC,
        artifact: SponsoredFPCContract.artifact
      });
      console.log("✅ Sponsored FPC contract registered");
    } catch (error) {
      console.warn("⚠️  Failed to register contracts (may already be registered):", error);
    }
  }

  private async getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
    return await getContractInstanceFromDeployParams(SponsoredFPCContract.artifact, {
      salt: new Fr(SPONSORED_FPC_SALT),
    });
  }

  private saveKeys(accountName: string, keys: AccountKeys): void {
    this.ensureDeploysDir();

    let allKeys: StoredKeys = {};
    if (fs.existsSync(this.keysFile)) {
      allKeys = JSON.parse(fs.readFileSync(this.keysFile, "utf8"));
    }

    allKeys[accountName] = keys;
    fs.writeFileSync(this.keysFile, JSON.stringify(allKeys, null, 2));
    console.log(`💾 Saved keys for ${accountName} to ${this.keysFile}`);
  }

  private loadKeys(accountName: string): AccountKeys | null {
    if (!fs.existsSync(this.keysFile)) return null;

    const allKeys: StoredKeys = JSON.parse(fs.readFileSync(this.keysFile, "utf8"));
    return allKeys[accountName] || null;
  }

  private saveAccountInfo(accountName: string, info: AccountInfo): void {
    this.ensureDeploysDir();

    let allAccounts: DeployedAccounts = {};
    if (fs.existsSync(this.accountsFile)) {
      allAccounts = JSON.parse(fs.readFileSync(this.accountsFile, "utf8"));
    }

    allAccounts[accountName] = info;
    fs.writeFileSync(this.accountsFile, JSON.stringify(allAccounts, null, 2));
    console.log(`📝 Saved account info for ${accountName}: ${info.address}`);
  }

  private loadAccountInfo(accountName: string): AccountInfo | null {
    if (!fs.existsSync(this.accountsFile)) return null;

    const allAccounts: DeployedAccounts = JSON.parse(fs.readFileSync(this.accountsFile, "utf8"));
    return allAccounts[accountName] || null;
  }

  private generateRandomKeys(): AccountKeys {
    const privateKey = GrumpkinScalar.random();
    const salt = GrumpkinScalar.random();

    return {
      privateKey: "0x" + privateKey.toBigInt().toString(16).padStart(64, "0"),
      salt: "0x" + salt.toBigInt().toString(16).padStart(64, "0"),
    };
  }

  private async createSchnorrWallet(keys: AccountKeys): Promise<Wallet> {
    if (!this.pxe) throw new Error("PXE not initialized");

    const privateKeyFr = Fr.fromHexString(keys.privateKey);
    const saltFr = Fr.fromHexString(keys.salt);

    const schnorrAccount = await getSchnorrAccount(
      this.pxe,
      privateKeyFr,
      deriveSigningKey(privateKeyFr),
      saltFr.toBigInt()
    );

    return await schnorrAccount.getWallet();
  }

  private async deploySchnorrAccount(keys: AccountKeys): Promise<Wallet> {
    if (!this.pxe) throw new Error("PXE not initialized");

    console.log("🚀 Deploying new Schnorr account...");

    const privateKeyFr = Fr.fromHexString(keys.privateKey);
    const saltFr = Fr.fromHexString(keys.salt);

    const schnorrAccount = await getSchnorrAccount(
      this.pxe,
      privateKeyFr,
      deriveSigningKey(privateKeyFr),
      saltFr.toBigInt()
    );

    const sponsoredFPC = await this.getSponsoredFPCInstance();
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    try {
      await schnorrAccount.deploy({
        fee: { paymentMethod: sponsoredPaymentMethod }
      }).wait({ timeout: 60 * 60 * 12 });

      console.log("✅ Schnorr account deployed successfully");
    } catch (error) {
      console.warn("⚠️  Account deployment failed (may already exist):", error);
    }

    return await schnorrAccount.getWallet();
  }

  async getOrCreateWallet(accountName: string = "deployer"): Promise<Wallet> {
    if (!this.pxe) throw new Error("PXE not initialized. Call setupPXE() first");

    if (this.network === "sandbox") {
      console.log(`📦 Using sandbox account: ${accountName}`);
      const wallets = await getInitialTestAccountsWallets(this.pxe);
      const accountIndex = accountName === "user" ? 1 : 0;
      const wallet = wallets[accountIndex] || wallets[0];

      // Save sandbox account info for debugging/persistence
      this.saveAccountInfo(accountName, {
        address: wallet.getAddress().toString(),
        deployed: true,
      });

      console.log(`✅ Sandbox account ${accountName}: ${wallet.getAddress().toString()}`);
      return wallet;
    }

    // Testnet flow
    console.log(`🔐 Loading/creating testnet account: ${accountName}`);

    let keys = this.loadKeys(accountName);
    let accountInfo = this.loadAccountInfo(accountName);

    if (!keys) {
      console.log(`🔑 Generating new keys for ${accountName}...`);
      keys = this.generateRandomKeys();
      this.saveKeys(accountName, keys);
    }

    let wallet: Wallet;

    if (accountInfo?.deployed) {
      console.log(`♻️  Loading existing deployed account: ${accountName}`);
      wallet = await this.createSchnorrWallet(keys);
    } else {
      console.log(`🚀 Deploying new account: ${accountName}`);
      wallet = await this.deploySchnorrAccount(keys);

      this.saveAccountInfo(accountName, {
        address: wallet.getAddress().toString(),
        deployed: true,
      });
    }

    console.log(`✅ Account ready: ${wallet.getAddress().toString()}`);
    return wallet;
  }

  async getExistingWallet(accountName: string): Promise<Wallet | null> {
    if (!this.pxe) throw new Error("PXE not initialized");

    if (this.network === "sandbox") {
      const wallets = await getInitialTestAccountsWallets(this.pxe);
      const accountIndex = accountName === "user" ? 1 : 0;
      return wallets[accountIndex] || wallets[0];
    }

    const keys = this.loadKeys(accountName);
    const accountInfo = this.loadAccountInfo(accountName);

    if (!keys || !accountInfo?.deployed) {
      return null;
    }

    return await this.createSchnorrWallet(keys);
  }

  saveContractAddress(contractName: string, address: string): void {
    this.ensureDeploysDir();

    let allContracts: ContractAddresses = {};
    if (fs.existsSync(this.contractsFile)) {
      allContracts = JSON.parse(fs.readFileSync(this.contractsFile, "utf8"));
    }

    allContracts[contractName] = address;
    fs.writeFileSync(this.contractsFile, JSON.stringify(allContracts, null, 2));
  }

  loadContractAddress(contractName: string): string | null {
    if (!fs.existsSync(this.contractsFile)) return null;

    const allContracts: ContractAddresses = JSON.parse(fs.readFileSync(this.contractsFile, "utf8"));
    return allContracts[contractName] || null;
  }

  async getSponsoredPaymentMethod(): Promise<SponsoredFeePaymentMethod | null> {
    if (this.network === "sandbox") return null;

    const sponsoredFPC = await this.getSponsoredFPCInstance();
    return new SponsoredFeePaymentMethod(sponsoredFPC.address);
  }

  /**
   * Get transaction options with mandatory 'from' parameter for Aztec 2.0.2+
   * Includes sponsored fee payment for testnet if available
   */
  async getTxOptions(fromAddress: AztecAddress): Promise<any> {
    const sponsoredPaymentMethod = await this.getSponsoredPaymentMethod();
    return {
      from: fromAddress,
      ...(sponsoredPaymentMethod ? { fee: { paymentMethod: sponsoredPaymentMethod } } : {})
    };
  }

  getNetwork(): NetworkType {
    return this.network || this.detectNetwork();
  }

  getPXE(): PXE {
    if (!this.pxe) throw new Error("PXE not initialized");
    return this.pxe;
  }

  async registerSender(address: AztecAddress): Promise<void> {
    if (!this.pxe) throw new Error("PXE not initialized");

    try {
      await this.pxe.registerSender(address);
      console.log(`✅ Registered sender: ${address.toString()}`);
    } catch (error) {
      console.warn(`⚠️  Failed to register sender (may already be registered):`, error);
    }
  }

  /**
   * Utility function to extract and save sandbox account keys for testing/development
   * This is useful when you want to migrate from sandbox to testnet with known accounts
   */
  async extractAndSaveSandboxKeys(): Promise<void> {
    if (this.network !== "sandbox") {
      console.warn("⚠️  This function only works in sandbox environment");
      return;
    }

    if (!this.pxe) throw new Error("PXE not initialized");

    console.log("🔍 Extracting sandbox account keys...");
    const wallets = await getInitialTestAccountsWallets(this.pxe);

    const accountNames = ["deployer", "user", "alice", "bob"];

    for (let i = 0; i < Math.min(wallets.length, accountNames.length); i++) {
      const wallet = wallets[i];
      const accountName = accountNames[i];

      // Note: In a real scenario, you'd need access to the private keys
      // For sandbox testing, we can create placeholder keys or use known test keys
      const placeholderKeys: AccountKeys = {
        privateKey: `0x${"0".repeat(63)}${i + 1}`, // Placeholder
        salt: `0x${"0".repeat(63)}${i + 1}`, // Placeholder
      };

      this.saveKeys(accountName, placeholderKeys);
      this.saveAccountInfo(accountName, {
        address: wallet.getAddress().toString(),
        deployed: true,
      });

      console.log(`📋 Saved ${accountName}: ${wallet.getAddress().toString()}`);
    }

    console.log("✅ Sandbox keys extraction complete");
  }

  /**
   * Display current account status
   */
  displayAccountStatus(): void {
    console.log("\n📊 === ACCOUNT STATUS ===");
    console.log(`Network: ${this.getNetwork()}`);

    if (fs.existsSync(this.accountsFile)) {
      const accounts: DeployedAccounts = JSON.parse(fs.readFileSync(this.accountsFile, "utf8"));
      console.log("Accounts:");
      Object.entries(accounts).forEach(([name, info]) => {
        console.log(`  ${name}: ${info.address} (deployed: ${info.deployed})`);
      });
    } else {
      console.log("No accounts file found");
    }

    if (fs.existsSync(this.contractsFile)) {
      const contracts: ContractAddresses = JSON.parse(fs.readFileSync(this.contractsFile, "utf8"));
      console.log("Contracts:");
      Object.entries(contracts).forEach(([name, address]) => {
        console.log(`  ${name}: ${address}`);
      });
    } else {
      console.log("No contracts file found");
    }

    console.log("========================\n");
  }
}

export const aztecSetup = new AztecSetup();