import { config } from "dotenv";
import { createAztecNodeClient, waitForNode, type AztecNode } from "@aztec/aztec.js/node";
import { getPXEConfig, type PXE } from "@aztec/pxe/server";
import { createStore } from "@aztec/kv-store/lmdb-v2";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";
import { getContractInstanceFromInstantiationParams, type ContractInstanceWithAddress } from "@aztec/stdlib/contract";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { GrumpkinScalar, Fr } from "@aztec/foundation/fields";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { SPONSORED_FPC_SALT } from "@aztec/constants";
import { AccountManager, type Wallet } from "@aztec/aztec.js/wallet";
import { registerInitialSandboxAccountsInWallet, TestWallet } from "@aztec/test-wallet/server";
import fs from "fs";
import { getDeploymentManager, type NetworkType } from "./deployment-manager.js";
import { AccountKeys, StoredKeys, AccountInfo, DeployedAccounts, ContractAddresses } from "./types.ts";
config();

/**
 * AztecSetup - Connection and account management for Aztec 3.0.0-devnet.2
 *
 * Proper architecture implementation:
 * 1. Node (blockchain connection)
 * 2. PXE (private execution environment - embedded library)
 * 3. Wallet (account management - extends BaseWallet)
 * 4. Accounts (signing objects created by AccountManager)
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

export class AztecSetup {
  private node: AztecNode | null = null;
  private pxe: PXE | null = null;
  private wallet: TestWallet | null = null;
  private network: NetworkType;
  private nodeUrl: string;
  private deploymentsDir: string;
  private keysFile: string;
  private accountsFile: string;
  private contractsFile: string;
  private pxeStoreDir: string;

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
          : "https://devnet.aztec-labs.com";
    }

    // Log deployment configuration
    deploymentManager.logDeploymentInfo();
  }

  /**
   * Initialize the Aztec setup
   * Creates the proper chain: Node → PXE → Wallet
   *
   * This must be called before using any account-related methods
   */
  async initialize(): Promise<void> {
    if (this.wallet) {
      console.log("Already initialized");
      return;
    }

    console.log(`Initializing Aztec setup for ${this.network} network`);
    console.log(`  NODE_URL: ${this.nodeUrl}`);
    console.log(`  PXE Store: ${this.pxeStoreDir}`);

    // 1. Create and connect to Aztec Node
    this.node = createAztecNodeClient(this.nodeUrl);
    await waitForNode(this.node);
    console.log(`✅ Connected to Aztec node`);

    // 2. Create TestWallet with persistent storage
    // TestWallet.create() creates PXE internally, so we pass config and store options
    const l1Contracts = await this.node.getL1ContractAddresses();
    const pxeConfig = {
      ...getPXEConfig(),
      l1Contracts,
      proverEnabled: this.network === 'sandbox' ? false : true,
      l2BlockPollingIntervalMS: this.network === 'sandbox' ? 1000 : 5000,
      l2StartingBlock: 1,
    };

    const pxeOptions = {
      store: await createStore('pxe', 2, {
        dataDirectory: this.pxeStoreDir,
        dataStoreMapSizeKb: 1_000_000 // 1GB
      })
    };

    this.wallet = await TestWallet.create(this.node, pxeConfig, pxeOptions);
    // Get PXE from wallet (it's a protected property in BaseWallet)
    this.pxe = (this.wallet as any).pxe;
    console.log(`✅ PXE initialized with persistent storage`);
    console.log(`✅ TestWallet created`);

    // 3. For sandbox, ensure SponsoredFPC is deployed
    // if (this.network === 'sandbox') {
      await this.ensureSponsoredFPCDeployed();
    // }

    console.log(`Initialization complete`);
  }

  /**
   * Get the wallet instance
   * @throws Error if initialize() hasn't been called
   */
  getWallet(): TestWallet {
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

  private async getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
    return await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
      salt: new Fr(SPONSORED_FPC_SALT),
    });
  }
  
  private async getSponsoredFPCAddress() {
    return (await this.getSponsoredFPCInstance()).address;
  }
  
  private async registerDeployedSponsoredFPCInWalletAndGetAddress(wallet: Wallet) {
    const fpc = await this.getSponsoredFPCInstance();
    // The following is no-op if the contract is already registered
    await wallet.registerContract(fpc, SponsoredFPCContract.artifact);
    return fpc.address;
  }
  


  
  /**
   * Deploy SponsoredFPC in sandbox if not already deployed
   * This is required for fee payment in sandbox mode
   */
  private async ensureSponsoredFPCDeployed(): Promise<void> {
    if (!this.wallet || !this.pxe) {
      throw new Error("Wallet not initialized");
    }
    const sponsoredFPCInstance = await this.getSponsoredFPCInstance();
    const sponsoredFPCAddress = sponsoredFPCInstance.address;

    try {
      const instance = await this.pxe.getContractInstance(sponsoredFPCAddress);
      if (instance) {
        console.log(`  SponsoredFPC already deployed at ${sponsoredFPCAddress.toString()}`);
        await this.registerDeployedSponsoredFPCInWalletAndGetAddress(this.wallet);
        return;
      }
    } catch (error) {
      console.error('Error checking SponsoredFPC deployment status:', error);
    }

    console.log("  SponsoredFPC not found, deploying...");

    const accounts: AztecAddress[] = await registerInitialSandboxAccountsInWallet(this.wallet!);
    const deployerAddress = accounts[0];
    console.log(`Using sandbox account ${deployerAddress.toString()} to deploy SponsoredFPC`);
    const deployment = SponsoredFPCContract.deploy(this.wallet).send({
      from: deployerAddress,
      contractAddressSalt: new Fr(SPONSORED_FPC_SALT),
      universalDeploy: true,
    });
    await deployment.wait();
    await this.registerDeployedSponsoredFPCInWalletAndGetAddress(this.wallet);
    console.log('SponsoredFPC registered in wallet');
  }

  /**
   * Check if an account contract is deployed on-chain
   * Uses PXE to query the contract instance
   */
  private async isAccountDeployedOnChain(address: AztecAddress): Promise<boolean> {
    if (!this.pxe) {
      throw new Error("PXE not initialized");
    }

    try {
      const instance = await this.pxe.getContractInstance(address);
      return instance !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for account notes to synchronize with the PXE
   * This is critical for testnet where block times are slower (5s vs 1s in sandbox)
   *
   * The SchnorrAccount contract has a `signing_public_key` note that must be synced
   * before the account can sign transactions. This method polls until that note is available.
   *
   * @param address - The account address to wait for
   * @param timeoutMs - Maximum time to wait in milliseconds (default: 60 seconds)
   * @throws Error if notes don't sync within timeout
   */
  private async waitForAccountNotesToSync(
    address: AztecAddress,
    timeoutMs: number = 60000
  ): Promise<void> {
    if (!this.pxe) {
      throw new Error("PXE not initialized");
    }

    const startTime = Date.now();
    const pollInterval = 2000; // Check every 2 seconds
    let attemptCount = 0;

    while (Date.now() - startTime < timeoutMs) {
      attemptCount++;

      try {
        // Query notes for the account contract address
        // The SchnorrAccount should have at least one note (signing_public_key)
        const notes = await this.pxe.getNotes({
          contractAddress: address,
        });

        if (notes.length > 0) {
          console.log(`   ✓ Found ${notes.length} note(s) for account (attempt ${attemptCount})`);
          return; // Success!
        }

        console.log(`   ⏳ No notes yet (attempt ${attemptCount}), waiting ${pollInterval}ms...`);
      } catch (error) {
        // PXE might still be syncing, continue polling
        console.log(`   ⏳ PXE still syncing (attempt ${attemptCount}), waiting ${pollInterval}ms...`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    throw new Error(
      `Timeout: Account notes failed to sync after ${elapsedSeconds}s (${attemptCount} attempts). ` +
      `This may indicate the account wasn't deployed properly or PXE is having connectivity issues.`
    );
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
   * Creates a Schnorr AccountManager from keys
   *
   * @param privateKey - Account secret key (Fr)
   * @param signingKey - Schnorr signing key (GrumpkinScalar)
   * @param salt - Account instantiation salt (Fr)
   * @returns AccountManager instance
   */
  private async createSchnorrAccountManager(
    privateKey: Fr,
    signingKey: GrumpkinScalar,
    salt: Fr
  ): Promise<AccountManager> {
    if (!this.wallet) throw new Error("Wallet not initialized. Call initialize() first");

    const accountContract = new SchnorrAccountContract(signingKey);

    // CRITICAL: Pass wallet (not node) to AccountManager.create()
    const accountManager = await AccountManager.create(
      this.wallet,
      privateKey,
      accountContract,
      salt
    );

    return accountManager;
  }

  /**
   * Deploy an AccountManager to the network
   *
   * CRITICAL: Account deployments must use from: AztecAddress.ZERO
   * because the account doesn't exist yet and can't sign its own deployment.
   */
  private async deployAccountManager(
    accountManager: AccountManager
  ): Promise<void> {
    const deployMethod = await accountManager.getDeployMethod();

    try {
      // Get sponsored payment method for fee payment
      const sponsoredPaymentMethod = await this.getSponsoredPaymentMethod();

      // Use AztecAddress.ZERO for account deployment (account can't sign its own deployment)
      await deployMethod.send({
        from: AztecAddress.ZERO,
        ...(sponsoredPaymentMethod ? { fee: { paymentMethod: sponsoredPaymentMethod } } : {}),
      }).wait({ timeout: 60 * 60 * 12 });

      console.log("Schnorr account deployed successfully");
    } catch (error) {
      console.warn("Account deployment failed (may already exist):", error);
    }
  }

  /**
   * Load or create an account
   * Returns the account's AztecAddress
   *
   * The account is automatically added to the wallet's internal storage
   *
   * @param accountName - Name identifier for the account (e.g., "deployer", "user1")
   * @returns AztecAddress of the account
   */
  async getOrCreateAccount(accountName: string = "deployer"): Promise<AztecAddress> {
    if (!this.wallet) throw new Error("Wallet not initialized. Call initialize() first");

    console.log(`Loading/creating account: ${accountName}`);

    // 1. Load or generate keys
    let keys = this.loadKeys(accountName);
    if (!keys) {
      console.log(`Generating new keys for ${accountName}...`);
      keys = this.generateRandomKeys();
      this.saveKeys(accountName, keys);
    }

    const privateKeyFr = Fr.fromHexString(keys.privateKey);
    const saltFr = Fr.fromHexString(keys.salt);
    const signingKey = deriveSigningKey(privateKeyFr);

    // 2. Create AccountManager
    const accountManager = await this.createSchnorrAccountManager(
      privateKeyFr,
      signingKey,
      saltFr
    );

    const address = accountManager.address;

    // 3. Check if account is actually deployed on-chain
    // (Don't trust accounts.json - sandbox resets invalidate it)
    const isDeployedOnChain = await this.isAccountDeployedOnChain(address);

    // For existing accounts, we need to ensure constructor was actually executed
    // If not, we force a deployment even if metadata exists
    let forceDeployment = false;
    if (isDeployedOnChain) {
      // Account metadata exists, but check if it's actually initialized
      try {
        // Try to get the account - this will fail if notes don't exist
        const testAccount = await accountManager.getAccount();
        // getCompleteAddress is synchronous, no await needed
        testAccount.getCompleteAddress();
        console.log(`   Account is properly initialized`);
      } catch (error) {
        console.log(`   Account metadata exists but not initialized, will redeploy`);
        forceDeployment = true;
      }
    }

    if (!isDeployedOnChain || forceDeployment) {
      console.log(`Deploying new account: ${accountName}`);

      const instance = accountManager.getInstance();
      const accountContract = new SchnorrAccountContract(signingKey);
      const artifact = await accountContract.getContractArtifact();
      await this.wallet.registerContract(instance, artifact, privateKeyFr);
      const account = await accountManager.getAccount();
      (this.wallet as any).accounts.set(address.toString(), account);

      await this.deployAccountManager(accountManager);

      this.saveAccountInfo(accountName, {
        address: address.toString(),
        deployed: true,
      });

    } else {

      const instance = accountManager.getInstance();
      const accountContract = new SchnorrAccountContract(signingKey);
      const artifact = await accountContract.getContractArtifact();

      try {
        await this.pxe!.registerAccount(privateKeyFr, instance.salt);
      } catch (error) {
        // May already be registered
      }

      try {
        await this.wallet.registerContract(instance, artifact, privateKeyFr);
      } catch (error) {
        // May already be registered
      }

      console.log(`   Waiting for note synchronization...`);
      await this.waitForAccountNotesToSync(address, 60000); // 60 second timeout
      console.log(`   Sync complete`);
    }

    const account = await accountManager.getAccount();
    (this.wallet as any).accounts.set(address.toString(), account);

    return address;
  }

  /**
   * Load a wallet from exact provided credentials
   * Useful for importing accounts from external sources
   *
   * @param credentials Object with address, signingKey, secretKey (privateKey), and salt
   * @returns AztecAddress of the loaded account
   */
  async loadAccountFromCredentials(credentials: {
    address: string;
    signingKey: string;
    secretKey: string;
    salt: string;
  }): Promise<AztecAddress> {
    if (!this.wallet) throw new Error("Wallet not initialized. Call initialize() first");

    console.log(`Loading account from provided credentials...`);
    console.log(`  Address: ${credentials.address}`);

    const privateKeyFr = Fr.fromHexString(credentials.secretKey);
    const signingKeyScalar = GrumpkinScalar.fromString(credentials.signingKey);
    const saltFr = Fr.fromHexString(credentials.salt);

    const accountManager = await this.createSchnorrAccountManager(
      privateKeyFr,
      signingKeyScalar,
      saltFr
    );

    // Verify the address matches
    const accountAddress = accountManager.address;
    if (accountAddress.toString() !== credentials.address) {
      throw new Error(
        `Address mismatch! Expected ${credentials.address} but got ${accountAddress.toString()}`
      );
    }

    // Get Account object and add to wallet
    const account = await accountManager.getAccount();
    // TestWallet has protected accounts Map - access it directly
    (this.wallet as any).accounts.set(accountAddress.toString(), account);

    console.log(`✅ Account loaded successfully: ${accountAddress.toString()}`);
    return accountAddress;
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
   * Get transaction options with mandatory "from" parameter for Aztec 3.0.0+
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

  /**
   * @deprecated Use getNode() instead
   */
  getNodeClient(): AztecNode | null {
    return this.node;
  }

  loadAllAccounts(): DeployedAccounts | null {
    if (!fs.existsSync(this.accountsFile)) return null;
    return JSON.parse(fs.readFileSync(this.accountsFile, "utf8"));
  }

  /**
   * Register a contract sender address with the wallet
   * Required before interacting with contracts
   */
  async registerSender(address: AztecAddress): Promise<void> {
    const wallet = this.getWallet();
    try {
      await wallet.registerSender(address);
      console.log("Registered sender: " + address.toString());
    } catch (error) {
      console.warn("Failed to register sender (may already be registered):", error);
    }
  }

  /**
   * Register a deployed contract instance with the Wallet
   * Required before calling contract methods
   */
  async registerContract(address: AztecAddress, artifact: any): Promise<void> {
    const node = this.getNode();
    const wallet = this.getWallet();

    try {
      console.log(`Fetching contract instance from node for ${address.toString()}...`);
      const contractInstance = await node.getContract(address);

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
}

export const aztecSetup = new AztecSetup();
