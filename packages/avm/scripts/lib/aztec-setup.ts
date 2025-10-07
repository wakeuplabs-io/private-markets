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
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { SchnorrAccountContractArtifact } from "@aztec/noir-contracts.js/SchnorrAccount";
import { SPONSORED_FPC_SALT } from "@aztec/constants";
import { createPXEService } from "@aztec/pxe/server";
import { getPXEServiceConfig } from "@aztec/pxe/config";
import { createStore } from "@aztec/kv-store/lmdb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AztecSetup - Connection and account management for Aztec
 * 
 * Important environment variables:
 * - NODE_URL: URL of the Aztec node (determines the network: local sandbox or remote testnet)
 *   - Sandbox: http://localhost:8080 (default)
 *   - Testnet: https://aztec-testnet-fullnode.zkv.xyz/ (default)
 * 
 * - PXE_URL: Only used in sandbox mode to connect to an existing PXE
 *   - Default: http://localhost:8080
 *   - In testnet, a local PXE is created connected to NODE_URL
 * 
 * The network (sandbox vs testnet) is determined by NODE_URL, NOT by PXE_URL
 * 
 * Behavior:
 * - Sandbox: Uses createPXEClient() to connect to a PXE running locally
 * - Testnet: Creates a local PXE with createPXEService() connected to the remote node
 */

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
  private nodeClient: any = null; // AztecNode client for testnet
  private network: NetworkType | null = null;
  private nodeUrl: string;
  private deploysDir: string;
  private keysFile: string;
  private accountsFile: string;
  private contractsFile: string;

  constructor() {
    const envNodeUrl = process.env.NODE_URL;
    
    if (envNodeUrl) {
      this.nodeUrl = envNodeUrl;
    } else {
      this.nodeUrl = "https://aztec-testnet-fullnode.zkv.xyz/";
    }
    
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
    return this.nodeUrl.includes("localhost") || this.nodeUrl.includes("127.0.0.1")
      ? "sandbox"
      : "testnet";
  }

  async setupPXE(): Promise<PXE> {
    if (this.pxe) return this.pxe;

    this.network = this.detectNetwork();

    console.log(`Connecting to ${this.network} network`);
    console.log(`  NODE_URL: ${this.nodeUrl}`);

    if (this.network === "testnet") {
      console.log("Creating local PXE connected to testnet node...");
      
      this.nodeClient = createAztecNodeClient(this.nodeUrl);
      
      const storeDir = path.join(this.deploysDir, "pxe-store");
      const store = await createStore("pxe", {
        dataDirectory: storeDir,
        dataStoreMapSizeKB: 1e6,
      });
      
      const config = getPXEServiceConfig();
      const l1Contracts = await this.nodeClient.getL1ContractAddresses();
      const fullConfig = {
        ...config,
        l1Contracts,
        proverEnabled: this.network === "testnet"
      };
      
      this.pxe = await createPXEService(this.nodeClient, fullConfig, { store });
      await waitForPXE(this.pxe);
      console.log("Local PXE created and connected to testnet node");
      console.log(`   Store directory: ${storeDir}`);
      
      await this.registerContractsForTestnet();
    } else {
      // Para sandbox, usar el cliente PXE directo
      const pxeUrl = process.env.PXE_URL || "http://localhost:8080";
      console.log(`  PXE_URL: ${pxeUrl}`);
      
      this.pxe = createPXEClient(pxeUrl);
      await waitForPXE(this.pxe);
      console.log(`Connected to sandbox PXE`);
    }

    return this.pxe;
  }

  private async registerContractsForTestnet(): Promise<void> {
    if (!this.pxe) throw new Error("PXE not initialized");

    console.log("Registering contracts for testnet...");

    try {
      const sponsoredFPC = await this.getSponsoredFPCInstance();
      await this.pxe.registerContract({
        instance: sponsoredFPC,
        artifact: SponsoredFPCContract.artifact
      });
      console.log("Sponsored FPC contract registered");
    } catch (error) {
      console.warn("Failed to register contracts (may already be registered):", error);
    }
  }

  private async getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
    return await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
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
    console.log(`Saved keys for ${accountName} to ${this.keysFile}`);
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
    console.log(`Saved account info for ${accountName}: ${info.address}`);
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

    const accountAddress = schnorrAccount.getAddress();

    // Para testnet con PXE local, necesitamos registrar la instancia del contrato de cuenta
    if (this.network === "testnet" && this.nodeClient) {
      console.log(`  Fetching account contract instance from node...`);
      try {
        const accountInstance = await this.nodeClient.getContract(accountAddress);
        if (accountInstance) {
          console.log(`  Registering account contract with PXE...`);
          await this.pxe.registerContract({
            instance: accountInstance,
            artifact: SchnorrAccountContractArtifact
          });
          console.log(`Account contract registered`);
        } else {
          console.warn(`Account contract instance not found on node`);
        }
      } catch (error) {
        console.warn(`Could not fetch/register account instance:`, error);
      }
    }

    const wallet = await schnorrAccount.getWallet();
    
    console.log(`Wallet loaded: ${wallet.getAddress().toString()}`);
    return wallet;
  }

  private async deploySchnorrAccount(keys: AccountKeys): Promise<Wallet> {
    if (!this.pxe) throw new Error("PXE not initialized");

    console.log("Deploying new Schnorr account...");

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

      console.log("Schnorr account deployed successfully");
    } catch (error) {
      console.warn("⚠️ Account deployment failed (may already exist):", error);
    }

    // Obtener wallet SIN re-registrar (mantiene las notas)
    const wallet = await schnorrAccount.getWallet();
    
    console.log(`Account ready: ${wallet.getAddress().toString()}`);
    return wallet;
  }

  async getOrCreateWallet(accountName: string = "deployer"): Promise<Wallet> {
    if (!this.pxe) throw new Error("PXE not initialized. Call setupPXE() first");

    if (this.network === "sandbox") {
      console.log(`Using sandbox account: ${accountName}`);
      const wallets = await getInitialTestAccountsWallets(this.pxe);
      const accountIndex = accountName === "user" ? 1 : 0;
      const wallet = wallets[accountIndex] || wallets[0];

      // Save sandbox account info for debugging/persistence
      this.saveAccountInfo(accountName, {
        address: wallet.getAddress().toString(),
        deployed: true,
      });

      console.log(`Account ${accountName}: ${wallet.getAddress().toString()}`);
      return wallet;
    }

    // Testnet flow
    console.log(`Loading/creating testnet account: ${accountName}`);

    let keys = this.loadKeys(accountName);
    let accountInfo = this.loadAccountInfo(accountName);

    if (!keys) {
      console.log(`Generating new keys for ${accountName}...`);
      keys = this.generateRandomKeys();
      this.saveKeys(accountName, keys);
    }

    let wallet: Wallet;

    if (accountInfo?.deployed) {
      console.log(`Loading existing deployed account: ${accountName}`);
      wallet = await this.createSchnorrWallet(keys);
    } else {
      console.log(`Deploying new account: ${accountName}`);
      wallet = await this.deploySchnorrAccount(keys);

      this.saveAccountInfo(accountName, {
        address: wallet.getAddress().toString(),
        deployed: true,
      });
    }

    console.log(`Account ready: ${wallet.getAddress().toString()}`);
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
  * Get transaction options with mandatory "from" parameter for Aztec 2.0.2+
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
      console.log("Registered sender: " + address.toString());
    } catch (error) {
      console.warn(" Failed to register sender (may already be registered):", error);
    }
  }

  /**
   * Register a deployed contract instance with the PXE
   * This is required when using a local PXE connected to testnet
   */
  async registerContract(address: AztecAddress, artifact: any): Promise<void> {
    if (!this.pxe) throw new Error("PXE not initialized");
    if (!this.nodeClient) {
      console.log("Skipping contract registration (sandbox mode or no node client)");
      return;
    }

    try {
      console.log(`Fetching contract instance from node for ${address.toString()}...`);
      const contractInstance = await this.nodeClient.getContract(address);

      if (!contractInstance) {
        console.warn(`⚠️  Contract instance not found on node for ${address.toString()}`);
        return;
      }

      console.log(`Registering contract with PXE...`);
      await this.pxe.registerContract({
        instance: contractInstance,
        artifact: artifact
      });

      console.log(`✅ Contract registered: ${address.toString()}`);
    } catch (error: any) {
      console.warn(`⚠️  Failed to register contract (may already be registered):`, error.message);
    }
  }
}

export const aztecSetup = new AztecSetup();