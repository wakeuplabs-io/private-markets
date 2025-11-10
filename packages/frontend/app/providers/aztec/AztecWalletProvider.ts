import type { IExtendedWalletProvider, IWalletAccount } from "@/types/wallet";
import { AztecAccount } from "./aztecAccount";
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
import { type ContractArtifact } from '@aztec/aztec.js/abi';
import { createLogger } from '@aztec/aztec.js/log';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { ContractFunctionInteraction } from '@aztec/aztec.js/contracts';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { getContractInstanceFromInstantiationParams } from '@aztec/stdlib/contract';
import { getDefaultInitializer } from '@aztec/stdlib/abi';
import { TestWallet } from '@aztec/test-wallet/client/lazy';
import { getPXEConfig } from '@aztec/pxe/config';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { SchnorrAccountContract } from '@aztec/accounts/schnorr';
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { TokenContract } from "@/lib/contracts/Token";
import { BetVaultContract } from "@/lib/contracts/BetVault";
// TODO: Uncomment when Wormhole contract is migrated to v3.0.0
// import { WormholeContract } from "@/lib/contracts/Wormhole";
import { createStore } from "@aztec/kv-store/indexeddb";
import { pxeService } from "@/services/pxeService";

const LOCAL_STORAGE_KEY = "aztec-account";
const DEFAULT_NODE_URL = "http://localhost:8080";

const logger = createLogger('wallet');
// Suppress source map warnings (non-critical debug info)
logger.level = 'warn';


export class AztecWalletProvider implements IExtendedWalletProvider {
  private pxe!: PXE;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private aztecNode: any = null; // AztecNode client for fetching contract instances
  private wallet!: TestWallet; // TestWallet for browser (wraps PXE internally)
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
    console.log('config', this.config);
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
      logger.info('TestWallet already initialized, skipping');
      return;
    }

    // If initialization is in progress, return the existing promise
    if (this.isInitializing && this.initializationPromise) {
      logger.info('Initialization already in progress, waiting for completion');
      return this.initializationPromise;
    }

    // Mark as initializing and create a new promise
    this.isInitializing = true;
    logger.info('🚀 Starting TestWallet initialization for browser...');

    this.initializationPromise = (async () => {
      try {
        const nodeUrl = this.config.nodeUrl || DEFAULT_NODE_URL;
        const isLocal = nodeUrl.includes('localhost') || nodeUrl.includes('127.0.0.1') || nodeUrl.includes('8080');

        logger.info(`Creating TestWallet in browser for ${isLocal ? 'sandbox' : 'testnet'}: ${nodeUrl}`);

        // 1. Create Aztec node client
        this.aztecNode = await createAztecNodeClient(nodeUrl);

        // 2. Create IndexedDB store (browser-compatible)
        const store = await createStore("pxe_data", {
          dataDirectory: "pxe",
          dataStoreMapSizeKb: 1e6,
        });

        // 3. Get PXE config
        const l1Contracts = await this.aztecNode.getL1ContractAddresses();
        const pxeConfig = {
          ...getPXEConfig(),
          l1Contracts,
          proverEnabled: this.config.proverEnabled,
        };

        // 4. Create TestWallet (includes PXE internally)
        this.wallet = await TestWallet.create(this.aztecNode, pxeConfig, { store });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.pxe = (this.wallet as any).pxe;  // Access internal PXE

        // Register PXE in global service for access by other providers
        pxeService.registerPXE(this.pxe);

        logger.info('✅ TestWallet initialized in browser');

        // Wait for PXE to sync with testnet node (only for testnet)
        await this.waitForPXESync();

        // Register Sponsored FPC Contract with PXE (only for sandbox/local)
        if (isLocal) {
          logger.info('Registering Sponsored FPC contract (sandbox mode)...');
          try {
            await this.pxe.registerContract({
              instance: await this.#getSponsoredFPCContract(),
              artifact: SponsoredFPCContractArtifact,
            });
          } catch (error) {
            logger.warn('⚠️ Could not register SponsoredFPC (may not be deployed):', error);
          }
        } else {
          logger.info('ℹ️  Skipping SponsoredFPC registration on testnet');
        }

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
    console.log('🔵 [REGISTER] Starting contract registration...');

    // Skip if in sandbox mode (no aztecNode client)
    if (!this.aztecNode) {
      console.log('🔵 [REGISTER] Sandbox mode detected, skipping contract registration');
      return;
    }

    // Register Token contract if address is available
    const tokenAddress = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS;
    console.log('🔵 [REGISTER] Token address from env:', tokenAddress);

    if (tokenAddress) {
      try {
        logger.info('Registering Token contract:', tokenAddress);
        const tokenAztecAddress = AztecAddress.fromString(tokenAddress);
        console.log('🔵 [REGISTER] Token AztecAddress parsed:', tokenAztecAddress.toString());

        // 🔑 THE KEY: Use aztecNode.getContract() instead of pxe.getContractInstance()
        console.log('🔵 [REGISTER] Fetching contract instance from Aztec node...');
        const contractInstance = await this.aztecNode.getContract(tokenAztecAddress);
        console.log('🔵 [REGISTER] Contract instance result:', contractInstance);

        if (contractInstance) {
          console.log('🔵 [REGISTER] Registering with PXE...');
          await this.pxe.registerContract({
            instance: contractInstance,
            artifact: TokenContract.artifact,
          });
          logger.info('✅ Token contract registered successfully');
          console.log('🔵 [REGISTER] ✅ Token registration complete');
        } else {
          logger.warn('⚠️  Token contract instance not found on node');
          console.log('🔵 [REGISTER] ⚠️  contractInstance is null/undefined');
        }
      } catch (error) {
        console.error('🔴 [REGISTER] Token registration error:', error);
        logger.warn('Failed to register Token contract (may already be registered or not deployed):', error);
      }
    } else {
      console.log('🔵 [REGISTER] No token address in env, skipping');
    }

    // Register BetVault contract if address is available
    const vaultAddress = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS;
    console.log('🔵 [REGISTER] Vault address from env:', vaultAddress);

    if (vaultAddress) {
      try {
        logger.info('Registering BetVault contract:', vaultAddress);
        const vaultAztecAddress = AztecAddress.fromString(vaultAddress);
        console.log('🔵 [REGISTER] Vault AztecAddress parsed:', vaultAztecAddress.toString());

        // Use aztecNode.getContract() for testnet
        console.log('🔵 [REGISTER] Fetching Vault instance from Aztec node...');
        const contractInstance = await this.aztecNode.getContract(vaultAztecAddress);
        console.log('🔵 [REGISTER] Vault instance result:', contractInstance);

        if (contractInstance) {
          console.log('🔵 [REGISTER] Registering Vault with PXE...');
          await this.pxe.registerContract({
            instance: contractInstance,
            artifact: BetVaultContract.artifact,
          });
          logger.info('✅ BetVault contract registered successfully');
          console.log('🔵 [REGISTER] ✅ Vault registration complete');
        } else {
          logger.warn('⚠️  BetVault contract instance not found on node');
          console.log('🔵 [REGISTER] ⚠️  Vault contractInstance is null/undefined');
        }
      } catch (error) {
        console.error('🔴 [REGISTER] Vault registration error:', error);
        logger.warn('Failed to register BetVault contract (may already be registered or not deployed):', error);
      }
    } else {
      console.log('🔵 [REGISTER] No vault address in env, skipping');
    }

    // TODO: Uncomment when Wormhole contract is migrated to v3.0.0
    // Register Wormhole contract if address is available
    // const wormholeAddress = process.env.NEXT_PUBLIC_WORMHOLE_CONTRACT_ADDRESS;
    // console.log('🔵 [REGISTER] Wormhole address from env:', wormholeAddress);

    // if (wormholeAddress) {
    //   try {
    //     logger.info('Registering Wormhole contract:', wormholeAddress);
    //     const wormholeAztecAddress = AztecAddress.fromString(wormholeAddress);
    //     console.log('🔵 [REGISTER] Wormhole AztecAddress parsed:', wormholeAztecAddress.toString());

    //     // Use aztecNode.getContract() for testnet
    //     console.log('🔵 [REGISTER] Fetching Wormhole instance from Aztec node...');
    //     const contractInstance = await this.aztecNode.getContract(wormholeAztecAddress);
    //     console.log('🔵 [REGISTER] Wormhole instance result:', contractInstance);

    //     if (contractInstance) {
    //       console.log('🔵 [REGISTER] Registering Wormhole with PXE...');
    //       await this.pxe.registerContract({
    //         instance: contractInstance,
    //         artifact: WormholeContract.artifact,
    //       });
    //       logger.info('✅ Wormhole contract registered successfully');
    //       console.log('🔵 [REGISTER] ✅ Wormhole registration complete');
    //     } else {
    //       logger.warn('⚠️  Wormhole contract instance not found on node');
    //       console.log('🔵 [REGISTER] ⚠️  Wormhole contractInstance is null/undefined');
    //     }
    //   } catch (error) {
    //     console.error('🔴 [REGISTER] Wormhole registration error:', error);
    //     logger.warn('Failed to register Wormhole contract (may already be registered or not deployed):', error);
    //   }
    // } else {
    //   console.log('🔵 [REGISTER] No wormhole address in env, skipping');
    // }

    console.log('🔵 [REGISTER] Contract registration complete');
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
   * Wait for PXE to be ready for operations
   * Only necessary for testnet, sandbox syncs instantly
   *
   * Note: In v3.0.0-devnet.4, we don't have direct sync status access,
   * so we wait a reasonable time for initial sync and rely on error handling
   */
  private async waitForPXESync(): Promise<void> {
    const isLocal = this.config.nodeUrl?.includes('localhost') ||
                    this.config.nodeUrl?.includes('127.0.0.1') ||
                    this.config.nodeUrl?.includes('8080');

    // Skip sync wait for sandbox (not necessary)
    if (isLocal) {
      return;
    }

    logger.info('⏳ Waiting for PXE to be ready...');

    // Wait a reasonable time for initial sync (10 seconds)
    // Errors will be caught and handled in account operations
    await new Promise(resolve => setTimeout(resolve, 10000));

    logger.info('✅ PXE ready for operations');
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
    console.log('[AztecWalletProvider] ✅ STEP 1: Account found in localStorage');

    console.log('[AztecWalletProvider] 🔵 STEP 2: Calling initialize()');
    await this.initialize();
    console.log('[AztecWalletProvider] ✅ STEP 2: Initialize complete');

    try {
      console.log('[AztecWalletProvider] 🔵 STEP 3: Parsing account data');
      const parsed: AztecAccountData = JSON.parse(account);
      console.log('[AztecWalletProvider] Account data:', {
        address: parsed.address,
        hasSigningKey: !!parsed.signingKey,
        hasSecretKey: !!parsed.secretKey,
        hasSalt: !!parsed.salt
      });

      if (!parsed.address || !parsed.signingKey || !parsed.secretKey || !parsed.salt) {
        throw new Error("Invalid account data in storage");
      }
      console.log('[AztecWalletProvider] ✅ STEP 3: Account data validated');

      // v3.0.0-devnet.4 pattern: Use AccountManager.create() with TestWallet
      console.log('[AztecWalletProvider] 🔵 STEP 4: Creating signing key from buffer');
      console.log('[AztecWalletProvider] Raw signingKey from storage:', {
        value: parsed.signingKey,
        length: parsed.signingKey.length,
        type: typeof parsed.signingKey,
        first20: parsed.signingKey.slice(0, 20)
      });

      // Remove '0x' prefix if present (for backwards compatibility)
      const signingKeyHex = parsed.signingKey.startsWith('0x')
        ? parsed.signingKey.slice(2)
        : parsed.signingKey;

      console.log('[AztecWalletProvider] SigningKey after removing 0x prefix:', {
        hex: signingKeyHex.slice(0, 40) + '...',
        length: signingKeyHex.length
      });

      const signingKeyBuffer = Buffer.from(signingKeyHex, 'hex');
      console.log('[AztecWalletProvider] SigningKey buffer:', {
        bufferLength: signingKeyBuffer.length,
        bufferHex: signingKeyBuffer.toString('hex').slice(0, 40)
      });

      if (signingKeyBuffer.length === 0) {
        throw new Error(`Invalid signingKey in localStorage: empty buffer. Raw value: "${parsed.signingKey}"`);
      }

      const signingPrivateKey = GrumpkinScalar.fromBuffer(signingKeyBuffer);
      console.log('[AztecWalletProvider] ✅ STEP 4: Signing key created');

      console.log('[AztecWalletProvider] 🔵 STEP 5: Creating Fr fields (secretKey, salt)');
      const secretKey = Fr.fromString(parsed.secretKey);
      const salt = Fr.fromString(parsed.salt);
      console.log('[AztecWalletProvider] ✅ STEP 5: Fr fields created', {
        secretKey: secretKey.toString().slice(0, 20) + '...',
        salt: salt.toString().slice(0, 20) + '...'
      });

      // Create account contract instance
      console.log('[AztecWalletProvider] 🔵 STEP 6: Creating SchnorrAccountContract');
      const accountContract = new SchnorrAccountContract(signingPrivateKey);
      console.log('[AztecWalletProvider] ✅ STEP 6: SchnorrAccountContract created');

      // Create AccountManager (v3.0.0-devnet.4: pass TestWallet, not PXE)
      console.log('[AztecWalletProvider] 🔵 STEP 7: Creating AccountManager with TestWallet');
      console.log('[AztecWalletProvider] AccountManager.create params:', {
        hasWallet: !!this.wallet,
        secretKey: secretKey.toString().slice(0, 20) + '...',
        accountContract: accountContract.constructor.name,
        salt: salt.toString().slice(0, 20) + '...'
      });

      const accountManager = await AccountManager.create(
        this.wallet,  // Pass TestWallet instead of PXE
        secretKey,
        accountContract,
        salt
      );
      console.log('[AztecWalletProvider] ✅ STEP 7: AccountManager created');

      console.log('[AztecWalletProvider] 🔵 STEP 8: Getting address and instance from AccountManager');
      const address = accountManager.address;
      const instance = accountManager.getInstance();
      console.log('[AztecWalletProvider] Address:', address.toString());
      console.log('[AztecWalletProvider] Instance:', {
        address: instance.address.toString(),
        salt: instance.salt.toString().slice(0, 20) + '...',
        deployer: instance.deployer.toString()
      });
      console.log('[AztecWalletProvider] ✅ STEP 8: Address and instance retrieved');

      console.log('[AztecWalletProvider] 🔵 STEP 9: Getting contract artifact');
      const artifact = await accountContract.getContractArtifact();
      console.log('[AztecWalletProvider] Artifact:', {
        name: artifact.name,
        functions: artifact.functions.length
      });
      console.log('[AztecWalletProvider] ✅ STEP 9: Contract artifact retrieved');

      // Register with PXE (not accountManager.register())
      console.log('[AztecWalletProvider] 🔵 STEP 10: Registering account with PXE');
      try {
        await this.pxe.registerAccount(secretKey, instance.salt);
        console.log('[AztecWalletProvider] ✅ STEP 10: Account registered with PXE');
      } catch (error) {
        // May already be registered, that's ok
        console.log('[AztecWalletProvider] ⚠️ STEP 10: Account already registered with PXE (or error):', error);
        logger.info('Account already registered with PXE');
      }

      // Register contract with wallet
      console.log('[AztecWalletProvider] 🔵 STEP 11: Registering contract with wallet');
      console.log('[AztecWalletProvider] registerContract params:', {
        instanceAddress: instance.address.toString(),
        artifactName: artifact.name,
        secretKey: secretKey.toString().slice(0, 20) + '...'
      });
      await this.wallet.registerContract(instance, artifact, secretKey);
      console.log('[AztecWalletProvider] ✅ STEP 11: Contract registered with wallet');

      // Get account and add to wallet's internal map
      console.log('[AztecWalletProvider] 🔵 STEP 12: Getting account instance from AccountManager');
      const accountInstance = await accountManager.getAccount();
      console.log('[AztecWalletProvider] ✅ STEP 12: Account instance retrieved');

      console.log('[AztecWalletProvider] 🔵 STEP 13: Adding account to wallet internal map');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.wallet as any).accounts.set(address.toString(), accountInstance);
      console.log('[AztecWalletProvider] ✅ STEP 13: Account added to wallet map');

      // Use the TestWallet directly (it wraps the account manager)
      console.log('[AztecWalletProvider] 🔵 STEP 14: Setting connected account and address');
      this.connectedAccount = this.wallet;
      this.connectedAddress = address;
      console.log('[AztecWalletProvider] ✅ STEP 14: Connected account set');

      console.log('[AztecWalletProvider] 🔵 STEP 15: Creating AztecAccount wrapper');
      const aztecAccount = new AztecAccount(this.wallet, address);
      console.log('[AztecWalletProvider] ✅ STEP 15: AztecAccount created');

      console.log('[AztecWalletProvider] 🎉 SUCCESS: Connect completed successfully!');
      return aztecAccount;
    } catch (error) {
      console.error('[AztecWalletProvider] ❌ ERROR in connect():', error);
      console.error('[AztecWalletProvider] Error stack:', error instanceof Error ? error.stack : 'No stack');

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

      // v3.0.0-devnet.4 pattern: Use AccountManager.create() with TestWallet
      const accountContract = new SchnorrAccountContract(signingKey);
      const accountManager = await AccountManager.create(
        this.wallet,  // Pass TestWallet instead of PXE
        secretKey,
        accountContract,
        salt
      );

      const address = accountManager.address;
      const instance = accountManager.getInstance();
      const artifact = await accountContract.getContractArtifact();

      // Register with PXE before deployment
      await this.pxe.registerAccount(secretKey, instance.salt);
      await this.wallet.registerContract(instance, artifact, secretKey);

      const accountInstance = await accountManager.getAccount();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.wallet as any).accounts.set(address.toString(), accountInstance);

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

      console.log('[AztecWalletProvider] 🔵 Converting signingKey to hex for storage');
      console.log('[AztecWalletProvider] signingKey type:', signingKey.constructor.name);
      const signingKeyBuffer = signingKey.toBuffer();
      console.log('[AztecWalletProvider] signingKeyBuffer length:', signingKeyBuffer.length);
      const signingKeyHex = signingKeyBuffer.toString('hex');
      console.log('[AztecWalletProvider] signingKeyHex:', {
        length: signingKeyHex.length,
        first20: signingKeyHex.slice(0, 20)
      });

      if (saveToStorage) {
        const accountData: AztecAccountData = {
          address: address.toString(),
          signingKey: signingKeyHex,
          secretKey: secretKey.toString(),
          salt: salt.toString(),
        };
        console.log('[AztecWalletProvider] 💾 Saving to localStorage:', {
          address: accountData.address,
          signingKeyLength: accountData.signingKey.length,
          signingKeyFirst20: accountData.signingKey.slice(0, 20),
          hasSecretKey: !!accountData.secretKey,
          hasSalt: !!accountData.salt
        });
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(accountData));
        console.log('[AztecWalletProvider] ✅ Account data saved to localStorage');
      }

      // Use the TestWallet directly (it wraps the account manager)
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

  async registerContract(
    artifact: unknown,
    deployer: unknown,
    salt: unknown,
    args: unknown[]
  ): Promise<void> {
    await this.initialize();

    const contractArtifact = artifact as ContractArtifact;
    const deployerAddress = deployer as AztecAddress;
    const deploymentSalt = salt as Fr;
    const constructorArgs = args;

    const instance = await getContractInstanceFromInstantiationParams(
      contractArtifact,
      {
        constructorArtifact: getDefaultInitializer(contractArtifact),
        constructorArgs: constructorArgs,
        deployer: deployerAddress,
        salt: deploymentSalt,
      }
    );

    await this.pxe.registerContract({
      instance,
      artifact: contractArtifact,
    });
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