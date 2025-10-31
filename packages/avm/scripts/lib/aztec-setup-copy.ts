import { config } from "dotenv";
import { createAztecNodeClient, waitForNode, type AztecNode } from "@aztec/aztec.js/node";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { getContractInstanceFromInstantiationParams, type ContractInstanceWithAddress } from "@aztec/stdlib/contract";
import type { Wallet } from "@aztec/aztec.js/wallet";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { GrumpkinScalar, Fr } from "@aztec/foundation/fields";
import { SchnorrAccountContract, getSchnorrAccountContractAddress } from "@aztec/accounts/schnorr";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { SPONSORED_FPC_SALT } from "@aztec/constants";
import { AccountManager } from "@aztec/aztec.js/wallet";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDeploymentManager, type NetworkType } from "./deployment-manager.js";
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AztecSetup - Connection and account management for Aztec 3.0.0
 *
 * In Aztec 3.0.0, the architecture is simplified:
 * - Connect to an Aztec Node (which provides wallet functionality)
 * - For sandbox: http://localhost:8080
 * - For testnet: https://aztec-testnet-fullnode.zkv.xyz/
 *
 * Environment variables:
 * - AZTEC_NETWORK: Explicitly set network ("sandbox" | "testnet")
 * - NODE_URL: URL of the Aztec node
 *
 * Network detection priority:
 * 1. AZTEC_NETWORK env var (explicit)
 * 2. NODE_URL (implicit: localhost = sandbox, else = testnet)
 * 3. Default: testnet
 *
 * Deployment artifacts are stored in: deployments/{network}/
 */

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
  private node: AztecNode | null = null;
  private network: NetworkType;
  private nodeUrl: string;
  private deploymentsDir: string;
  private keysFile: string;
  private accountsFile: string;
  private contractsFile: string;
  private pxeStoreDir: string;
  private wallet: Wallet;

  constructor(network?: NetworkType) {
    // Use deployment manager for network detection and paths
    const deploymentManager = getDeploymentManager(network);
    this.network = deploymentManager.getNetwork();
    this.deploymentsDir = deploymentManager.getDeploymentsDir();
    this.keysFile = deploymentManager.getKeysFile();
    this.accountsFile = deploymentManager.getAccountsFile();
    this.contractsFile = deploymentManager.getContractsFile();
    this.pxeStoreDir = deploymentManager.getPXEStoreDir();

    // Set node URL based on network
    const envNodeUrl = process.env.NODE_URL;
    if (envNodeUrl) {
      this.nodeUrl = envNodeUrl;
    } else {
      // Default URLs by network
      this.nodeUrl =
        this.network === "sandbox"
          ? "http://localhost:8080"
          : "https://aztec-testnet-fullnode.zkv.xyz/";
    }

    // Log deployment configuration
    deploymentManager.logDeploymentInfo();
  }

  private ensureDeploymentsDir(): void {
    if (!fs.existsSync(this.deploymentsDir)) {
      fs.mkdirSync(this.deploymentsDir, { recursive: true });
    }
  }

  async setupPXE(): Promise<AztecNode> {
    if (this.node) return this.node;

    console.log(`Connecting to ${this.network} network`);
    console.log(`  NODE_URL: ${this.nodeUrl}`);

    this.node = createAztecNodeClient(this.nodeUrl);
    await waitForNode(this.node);

    console.log(`Connected to Aztec node`);

    return this.node;
  }

  private async getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
    return await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
      salt: new Fr(SPONSORED_FPC_SALT),
    });
  }

  private saveKeys(accountName: string, keys: AccountKeys): void {
    this.ensureDeploymentsDir();

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
    this.ensureDeploymentsDir();

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

  /**
   * Creates a Schnorr AccountManager from keys (does not deploy)
   * Used for loading existing accounts or preparing for deployment
   *
   * @param privateKey - Account secret key (Fr)
   * @param signingKey - Schnorr signing key (GrumpkinScalar)
   * @param salt - Account instantiation salt (bigint)
   * @returns AccountManager instance
   */
  private async createSchnorrAccountManager(
    privateKey: Fr,
    signingKey: GrumpkinScalar,
    salt: bigint
  ): Promise<AccountManager> {
    if (!this.node) throw new Error("Node not initialized");

    const accountContract = new SchnorrAccountContract(signingKey);

    const accountManager = await AccountManager.create(
      this.wallet,
      privateKey,
      accountContract,
      salt
    );

    return accountManager;
  }

  /**
   * Gets a Wallet from an AccountManager
   *
   * @param accountManager - AccountManager instance
   * @returns Wallet ready to use
   */
  private async getWalletFromAccountManager(
    accountManager: AccountManager
  ): Promise<AccountWithSecretKey> {
    const wallet = await accountManager.getAccount();
    return wallet;
  }

  /**
   * Deploys an AccountManager to the network
   * Uses sponsored fee payment method if available
   *
   * @param accountManager - AccountManager to deploy
   */
  private async deployAccountManager(
    accountManager: AccountManager
  ): Promise<void> {
    const deployMethod = await accountManager.getDeployMethod();

    const sponsoredFPC = await this.getSponsoredFPCInstance();
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    try {
      await deployMethod.send({
        from: accountManager.address,
        fee: { paymentMethod: sponsoredPaymentMethod }
      }).wait({ timeout: 60 * 60 * 12 });

      console.log("Schnorr account deployed successfully");
    } catch (error) {
      console.warn("Account deployment failed (may already exist):", error);
    }
  }

  private async createSchnorrWallet(keys: AccountKeys): Promise<Wallet> {
    if (!this.node) throw new Error("Node not initialized");

    const privateKeyFr = Fr.fromHexString(keys.privateKey);
    const saltFr = Fr.fromHexString(keys.salt);
    const signingKey = deriveSigningKey(privateKeyFr);

    const accountManager = await this.createSchnorrAccountManager(
      privateKeyFr,
      signingKey,
      saltFr.toBigInt()
    );

    const wallet = await this.getWalletFromAccountManager(accountManager);

    const address = await this.getAddressFromWallet(wallet);
    console.log(`Wallet loaded: ${address}`);
    return wallet;
  }

  private async deploySchnorrAccount(keys: AccountKeys): Promise<Wallet> {
    if (!this.node) throw new Error("Node not initialized");

    console.log("Deploying new Schnorr account...");

    const privateKeyFr = Fr.fromHexString(keys.privateKey);
    const saltFr = Fr.fromHexString(keys.salt);
    const signingKey = deriveSigningKey(privateKeyFr);

    const accountManager = await this.createSchnorrAccountManager(
      privateKeyFr,
      signingKey,
      saltFr.toBigInt()
    );

    await this.deployAccountManager(accountManager);

    const wallet = await this.getWalletFromAccountManager(accountManager);

    const address = await this.getAddressFromWallet(wallet);
    console.log(`Account ready: ${address}`);
    return wallet;
  }

  async getOrCreateWallet(accountName: string = "deployer"): Promise<Wallet> {
    if (!this.node) throw new Error("Node not initialized. Call setupPXE() first");
    console.log(`Loading/creating account: ${accountName}`);

    let keys = this.loadKeys(accountName);
    let accountInfo = this.loadAccountInfo(accountName);
    if (!keys) {
      console.log(`Generating new keys for ${accountName}...`);
      keys = this.generateRandomKeys();
      this.saveKeys(accountName, keys);
    }

    let wallet: Wallet;
    let address: string;
    if (accountInfo?.deployed) {
      console.log(`Loading existing deployed account: ${accountName}`);
      wallet = await this.createSchnorrWallet(keys);
      address = await this.getAddressFromWallet(wallet);
    } else {
      console.log(`Deploying new account: ${accountName}`);
      wallet = await this.deploySchnorrAccount(keys);
      address = await this.getAddressFromWallet(wallet);
      this.saveAccountInfo(accountName, {
        address,
        deployed: true,
      });
    }

    console.log(`Account ready: ${address}`);
    return wallet;
  }

  saveContractAddress(contractName: string, address: string): void {
    this.ensureDeploymentsDir();

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
    return this.network;
  }

  getPXE(): AztecNode {
    if (!this.node) throw new Error("Node not initialized");
    return this.node;
  }

  getNodeClient(): AztecNode | null {
    return this.node;
  }

  loadAllAccounts(): DeployedAccounts | null {
    if (!fs.existsSync(this.accountsFile)) return null;
    return JSON.parse(fs.readFileSync(this.accountsFile, "utf8"));
  }

  async registerSender(wallet: Wallet, address: AztecAddress): Promise<void> {
    try {
      await wallet.registerSender(address);
      console.log("Registered sender: " + address.toString());
    } catch (error) {
      console.warn(" Failed to register sender (may already be registered):", error);
    }
  }

  /**
   * Register a deployed contract instance with a Wallet
   * In 3.0.0, we fetch the contract instance from the node first
   */
  async registerContract(wallet: Wallet, address: AztecAddress, artifact: any): Promise<void> {
    if (!this.node) throw new Error("Node not initialized");

    try {
      console.log(`Fetching contract instance from node for ${address.toString()}...`);
      const contractInstance = await this.node.getContract(address);

      if (!contractInstance) {
        console.warn(`⚠️  Contract instance not found on node for ${address.toString()}`);
        return;
      }

      console.log(`Registering contract with wallet...`);
      await wallet.registerContract({
        instance: contractInstance,
        artifact: artifact
      });

      console.log(`✅ Contract registered: ${address.toString()}`);
    } catch (error: any) {
      console.warn(`⚠️  Failed to register contract (may already be registered):`, error.message);
    }
  }

  /**
   * Create or load a wallet from exact provided credentials
   * @param credentials Object with address, signingKey, secretKey (privateKey), and salt
   * @returns Wallet instance
   */
  async loadWalletFromCredentials(credentials: {
    address: string;
    signingKey: string;
    secretKey: string;
    salt: string;
  }): Promise<Wallet> {
    if (!this.node) throw new Error("Node not initialized");

    console.log(`Loading wallet from provided credentials...`);
    console.log(`  Address: ${credentials.address}`);

    const privateKeyFr = Fr.fromHexString(credentials.secretKey);
    const signingKeyScalar = GrumpkinScalar.fromString(credentials.signingKey);
    const saltFr = Fr.fromHexString(credentials.salt);

    const accountManager = await this.createSchnorrAccountManager(
      privateKeyFr,
      signingKeyScalar,
      saltFr.toBigInt()
    );

    // Verify the address matches
    const accountAddress = accountManager.address;
    if (accountAddress.toString() !== credentials.address) {
      throw new Error(
        `Address mismatch! Expected ${credentials.address} but got ${accountAddress.toString()}`
      );
    }

    const wallet = await this.getWalletFromAccountManager(accountManager);

    const address = await this.getAddressFromWallet(wallet);
    console.log(`✅ Wallet loaded successfully: ${address}`);
    return wallet;
  }

  async getAddressFromWallet(wallet: Wallet): Promise<string> {
    const accounts = await wallet.getAccounts();
    const addr = accounts[0]?.item;
    return addr?.toString() || "";
  }
}

export const aztecSetup = new AztecSetup();
