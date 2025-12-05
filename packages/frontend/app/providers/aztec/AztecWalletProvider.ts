import type { IExtendedWalletProvider, IWalletAccount } from "@/types/wallet";
import { AztecAccount } from "./AztecAccount";
import type {
  AztecWalletConfig,
  AztecAccountData,
  CreateAccountOptions,
} from "./types";
import { Fr, GrumpkinScalar } from '@aztec/foundation/fields';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { AuthWitness } from '@aztec/stdlib/auth-witness';
import { PXE } from '@aztec/pxe/client/lazy';
import { type Wallet, AccountManager } from '@aztec/aztec.js/wallet';
import { createLogger } from '@aztec/aztec.js/log';
import { ContractFunctionInteraction } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import { EmbeddedWallet } from './embedded-wallet';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { SchnorrAccountContract } from '@aztec/accounts/schnorr';
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { TokenContract } from "@/lib/contracts/Token";
import { BetVaultContract } from "@/lib/contracts/BetVault";
import { WormholeContract } from "@/lib/contracts/Wormhole";
import { inspectPXEIndexedDB, cleanPXEIndexedDB } from "@/lib/aztec/pxeErrorHandler";
import { pxeService } from "@/services/pxe/pxeService";

const LOCAL_STORAGE_KEY = "aztec-account";
const DEFAULT_NODE_URL = "http://localhost:8080";

const logger = createLogger('wallet');
// Suppress source map warnings (non-critical debug info)
logger.level = 'warn';


export class AztecWalletProvider implements IExtendedWalletProvider {
  private pxe!: PXE;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private aztecNode: any = null; // AztecNode client for fetching contract instances
  private wallet!: EmbeddedWallet; // EmbeddedWallet for browser (wraps PXE internally)
  private connectedAccount: Wallet | null = null;
  private connectedAddress: AztecAddress | null = null;
  private config: AztecWalletConfig;
  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: AztecWalletConfig = {}) {
    this.config = {
      nodeUrl: config.nodeUrl || DEFAULT_NODE_URL,
      proverEnabled: config.proverEnabled ?? true,
      accountType: config.accountType || "schnorr",
    };
  }

  getProviderName(): string {
    return "aztec";
  }

  /**
   * Check if PXE is currently being initialized
   * @returns True if initialization is in progress
   */
  getIsInitializing(): boolean {
    return this.isInitializing;
  }

  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.wallet) {
      logger.info('EmbeddedWallet already initialized, skipping');
      return;
    }

    // If initialization is in progress, return the existing promise
    if (this.isInitializing && this.initializationPromise) {
      logger.info('Initialization already in progress, waiting for completion');
      return this.initializationPromise;
    }

    // Mark as initializing and create a new promise
    this.isInitializing = true;
    logger.info('🚀 Starting EmbeddedWallet initialization for browser...');

    this.initializationPromise = (async () => {
      try {
        const nodeUrl = this.config.nodeUrl || DEFAULT_NODE_URL;
        const isLocal = nodeUrl.includes('localhost') || nodeUrl.includes('127.0.0.1') || nodeUrl.includes('8080');

        logger.info(`Creating EmbeddedWallet in browser for ${isLocal ? 'sandbox' : 'testnet'}: ${nodeUrl}`);

        // 🔍 DEBUG: Inspect IndexedDB before initialization
        await inspectPXEIndexedDB('pxe_data');

        // 🧹 DEBUG: Clean IndexedDB to start fresh (TEMPORARY - for investigation)
        const CLEAN_INDEXEDDB = true; // Set to false after finding the issue
        if (CLEAN_INDEXEDDB) {
          try {
            await cleanPXEIndexedDB('pxe_data');
          } catch (error) {
            logger.warn('Failed to clean IndexedDB (might not exist):', error);
          }
        }

        // EmbeddedWallet.initialize() creates node client, PXE, and registers SponsoredFPC
        this.wallet = await EmbeddedWallet.initialize(nodeUrl);

        // Access PXE and AztecNode from wallet via public getters
        this.pxe = this.wallet.getPXE();
        this.aztecNode = this.wallet.getAztecNode();

        // Register PXE and AztecNode in global service for access by other providers
        await pxeService.registerPXE(this.pxe, this.aztecNode);

        logger.info('✅ EmbeddedWallet initialized in browser');
        logger.info('ℹ️  SponsoredFPC already registered by EmbeddedWallet.initialize()');

        // Register deployed contracts from environment variables
        await this.registerDeployedContracts();

        logger.info('✅ Initialization complete');
      } catch (error) {
        logger.error('❌ Initialization failed:', error);
        throw error;
      } finally {
        this.isInitializing = false;
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  async registerDeployedContracts(): Promise<void> {
    const tokenAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;
    if (tokenAddress) {
      try {
        logger.info('Registering Token contract:', tokenAddress);
        const tokenAztecAddress = AztecAddress.fromString(tokenAddress);

        const contractInstance = await this.aztecNode.getContract(tokenAztecAddress);
        await this.pxe.registerContract({
          instance: contractInstance,
          artifact: TokenContract.artifact,
        });
        logger.info('✅ Token contract registered successfully');

      } catch (error) {
        console.error('🔴 [REGISTER] Token registration error:', error);
        logger.warn('Failed to register Token contract (may already be registered or not deployed):', error);
      }
    } else {
      console.log('🔵 [REGISTER] No token address in env, skipping');
    }

    const vaultAddress = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS;

    if (vaultAddress) {
      try {
        const vaultAztecAddress = AztecAddress.fromString(vaultAddress);
        const contractInstance = await this.aztecNode.getContract(vaultAztecAddress);

        if (contractInstance) {
          await this.pxe.registerContract({
            instance: contractInstance,
            artifact: BetVaultContract.artifact,
          });
          logger.info('✅ BetVault contract registered successfully');
        }
      } catch (error) {
        logger.warn('Failed to register BetVault contract (may already be registered or not deployed):', error);
      }
    }

    const wormholeAddress = process.env.NEXT_PUBLIC_WORMHOLE_CONTRACT_ADDRESS;

    if (wormholeAddress) {
      try {
        const wormholeAztecAddress = AztecAddress.fromString(wormholeAddress);

        const contractInstance = await this.aztecNode.getContract(wormholeAztecAddress);

        if (contractInstance) {
          await this.pxe.registerContract({
            instance: contractInstance,
            artifact: WormholeContract.artifact,
          });
        }
      } catch (error) {
        logger.warn('Failed to register Wormhole contract (may already be registered or not deployed):', error);
      }
    }
  }

  async #getSponsoredFPCContract() {
    const instance = await getContractInstanceFromInstantiationParams(
      SponsoredFPCContractArtifact,
      {
        salt: new Fr(SPONSORED_FPC_SALT),
      }
    );

    return instance;
  }

  /**
   * Wait for account to be ready after deployment
   * Ensures account is registered before returning
   *
   * Note: In v3.0.0-devnet.4, we give the PXE time to process the deployment
   * and rely on error handling for sync issues
   */
  private async waitForAccountSync(address: AztecAddress): Promise<void> {
    const isLocal = this.config.nodeUrl?.includes('localhost') ||
                    this.config.nodeUrl?.includes('127.0.0.1') ||
                    this.config.nodeUrl?.includes('8080');

    // Skip for sandbox (not necessary)
    if (isLocal) {
      return;
    }

    logger.info('⏳ Waiting for account to be ready...');

    // Give PXE time to process the account deployment (5 seconds)
    // Errors will be caught and handled in subsequent operations
    await new Promise(resolve => setTimeout(resolve, 5000));

    logger.info(`✅ Account ${address.toString().slice(0, 10)}... ready`);
  }

  async connect(): Promise<IWalletAccount> {
    console.log('[AztecWalletProvider] 🔵 STEP 1: Starting connect()');

    const account = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!account) {
      throw new Error("No existing account found. Please create an account first.");
    }
    await this.initialize();
    try {
      const parsed: AztecAccountData = JSON.parse(account);

      if (!parsed.address || !parsed.signingKey || !parsed.secretKey || !parsed.salt) {
        throw new Error("Invalid account data in storage");
      }
      const signingKeyHex = parsed.signingKey.startsWith('0x')
        ? parsed.signingKey.slice(2)
        : parsed.signingKey;

      const signingKeyBuffer = Buffer.from(signingKeyHex, 'hex');

      if (signingKeyBuffer.length === 0) {
        throw new Error(`Invalid signingKey in localStorage: empty buffer. Raw value: "${parsed.signingKey}"`);
      }

      const signingPrivateKey = GrumpkinScalar.fromBuffer(signingKeyBuffer);
      const secretKey = Fr.fromString(parsed.secretKey);
      const salt = Fr.fromString(parsed.salt);

      const accountContract = new SchnorrAccountContract(signingPrivateKey);

      const accountManager = await AccountManager.create(
        this.wallet,  // Pass EmbeddedWallet (implements Wallet interface)
        secretKey,
        accountContract,
        salt
      );
      const address = accountManager.address;
      const instance = accountManager.getInstance();
      const artifact = await accountContract.getContractArtifact();
      try {
        await this.pxe.registerAccount(secretKey, instance.salt);
      } catch {
        // May already be registered, that's ok
      }
      // Register account contract with PXE (needed for EmbeddedWallet.simulateTx)
      await this.wallet.registerContract(instance, artifact, secretKey);
      const accountInstance = await accountManager.getAccount();
      // EmbeddedWallet exposes accounts as a public property
      this.wallet.accounts.set(address.toString(), accountInstance);
      this.connectedAccount = this.wallet;
      this.connectedAddress = address;
      const aztecAccount = new AztecAccount(this.wallet, address);

      return aztecAccount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Detect sync-related errors and provide user-friendly messages
      if (errorMessage.includes('No local block hash') || errorMessage.includes('Failed to get a note')) {
        throw new Error(
          'Network synchronization failed. This can happen when the testnet is very active.\n\n' +
          'Solutions:\n' +
          '1. Wait a moment and try again\n' +
          '2. Refresh the page to restart sync\n' +
          '3. Clear browser data (Settings > Storage) if problem persists\n\n' +
          `Technical details: ${errorMessage}`
        );
      }

      throw new Error(`Failed to connect to existing account: ${errorMessage}`);
    }
  }

  async createAccount(options?: unknown): Promise<IWalletAccount> {
    const createOptions = options as CreateAccountOptions | undefined;
    const saveToStorage = createOptions?.saveToStorage ?? true;

    await this.initialize();

    try {
      const salt = Fr.random();
      const secretKey = Fr.random();
      const signingKey = deriveSigningKey(secretKey);

      // v3.0.0-devnet.4 pattern: Use AccountManager.create() with EmbeddedWallet
      const accountContract = new SchnorrAccountContract(signingKey);
      const accountManager = await AccountManager.create(
        this.wallet,  // Pass EmbeddedWallet (implements Wallet interface)
        secretKey,
        accountContract,
        salt
      );

      const address = accountManager.address;
      const instance = accountManager.getInstance();
      const artifact = await accountContract.getContractArtifact();

      // Register with PXE before deployment
      await this.pxe.registerAccount(secretKey, instance.salt);
      // Register account contract with PXE (needed for EmbeddedWallet.simulateTx)
      await this.wallet.registerContract(instance, artifact, secretKey);

      const accountInstance = await accountManager.getAccount();
      // EmbeddedWallet exposes accounts as a public property
      this.wallet.accounts.set(address.toString(), accountInstance);

      const deployMethod = await accountManager.getDeployMethod();

      // Try to use SponsoredFPC if available, otherwise proceed without fee payment
      let feePaymentMethod;
      try {
        const sponsoredPFCContract = await this.#getSponsoredFPCContract();
        const instance = await this.pxe.getContractInstance(sponsoredPFCContract.address);
        if (instance) {
          // v3.0.0-devnet.4: Create SponsoredFeePaymentMethod directly
          feePaymentMethod = new SponsoredFeePaymentMethod(sponsoredPFCContract.address);
          logger.info('Using SponsoredFPC for account deployment');
        }
      } catch {
        logger.info('SponsoredFPC not available, deploying without fee payment');
      }

      const deployOpts = {
        from: AztecAddress.ZERO,
        ...(feePaymentMethod && { fee: { paymentMethod: feePaymentMethod } }),
      };

      // v3.0.0-devnet.4: Call send() directly, no prove() step
      const receipt = await deployMethod.send(deployOpts).wait({ timeout: 120 });

      logger.info('Account deployed', receipt);

      // Wait for account notes to sync (only for testnet)
      await this.waitForAccountSync(address);

      const signingKeyBuffer = signingKey.toBuffer();
      const signingKeyHex = signingKeyBuffer.toString('hex');

      if (saveToStorage) {
        const accountData: AztecAccountData = {
          address: address.toString(),
          signingKey: signingKeyHex,
          secretKey: secretKey.toString(),
          salt: salt.toString(),
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(accountData));
      }

      this.connectedAccount = this.wallet;
      this.connectedAddress = address;

      return new AztecAccount(this.wallet, address);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Detect sync-related errors and provide user-friendly messages
      if (errorMessage.includes('No local block hash') || errorMessage.includes('Failed to get a note')) {
        throw new Error(
          'Network synchronization failed. This can happen when the testnet is very active.\n\n' +
          'Solutions:\n' +
          '1. Wait a moment and try again\n' +
          '2. Refresh the page to restart sync\n' +
          '3. Clear browser data (Settings > Storage) if problem persists\n\n' +
          `Technical details: ${errorMessage}`
        );
      }

      throw new Error(`Failed to create account: ${errorMessage}`);
    }
  }

  disconnect(): void {
    this.connectedAccount = null;
    this.connectedAddress = null;
    // Don't clear PXE on disconnect, it can be reused
  }

  clearAccount(): void {
    this.connectedAccount = null;
    this.connectedAddress = null;
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    // Clear PXE when clearing account completely
    pxeService.clearPXE();
  }

  getAccount(): IWalletAccount | null {
    if (!this.connectedAccount || !this.connectedAddress) {
      return null;
    }
    return new AztecAccount(this.connectedAccount, this.connectedAddress);
  }

  getConnectedAccount() {
    if (!this.connectedAccount) {
      return null;
    }
    return this.connectedAccount;
  }

  isConnected(): boolean {
    return this.connectedAccount !== null;
  }

  async sendTransaction(interaction: unknown, authWitnesses?: AuthWitness[], from?: AztecAddress): Promise<void> {
    if (!this.connectedAccount) {
      throw new Error("No account connected. Please connect an account first.");
    }

    let contractInteraction = interaction as ContractFunctionInteraction;

    // Apply auth witnesses if provided
    if (authWitnesses && authWitnesses.length > 0) {
      contractInteraction = contractInteraction.with({ authWitnesses });
    }

    // Try to use SponsoredFPC if available
    const sendOpts = {
      from: from ?? this.connectedAddress!,
      fee: undefined as { paymentMethod: SponsoredFeePaymentMethod } | undefined,
    };

    try {
      const sponsoredPFCContract = await this.#getSponsoredFPCContract();
      const instance = await this.pxe.getContractInstance(sponsoredPFCContract.address);
      if (instance) {
        sendOpts.fee = {
          paymentMethod: new SponsoredFeePaymentMethod(sponsoredPFCContract.address),
        };
        logger.info('Using SponsoredFPC for transaction');
      }
    } catch {
      logger.info('SponsoredFPC not available, sending transaction without fee payment');
    }

    // v3.0.0-devnet.4: Call send() directly, no prove() step
    await contractInteraction.send(sendOpts).wait({ timeout: 120 });
  }

  async simulateTransaction(interaction: unknown): Promise<unknown> {
    if (!this.connectedAccount) {
      throw new Error("No account connected. Please connect an account first.");
    }

    const contractInteraction = interaction as ContractFunctionInteraction;
    const res = await contractInteraction.simulate({
      from: this.connectedAddress!,
    });
    return res;
  }

  getPXE(): PXE {
    return this.pxe;
  }

  /**
   * Check if there's an existing account in localStorage
   * @returns True if an account exists in localStorage
   */
  hasExistingAccount(): boolean {
    const account = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!account) {
      return false;
    }

    try {
      const parsed = JSON.parse(account);
      const hasValidData = !!(parsed.address && parsed.signingKey && parsed.secretKey);
      
      // Additional validation: ensure address is a valid hex string
      if (hasValidData && typeof parsed.address === 'string' && parsed.address.startsWith('0x')) {
        return true;
      }
      
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return false;
    } catch {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return false;
    }
  }

  /**
   * Get the current account status
   * @returns The account status: 'connected' if connected, 'exists' if account exists but not connected, 'none' if no account
   */
  getAccountStatus(): 'none' | 'exists' | 'connected' {
    if (this.isConnected()) {
      return 'connected';
    }

    if (this.hasExistingAccount()) {
      return 'exists';
    }

    return 'none';
  }
}