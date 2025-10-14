import type { IExtendedWalletProvider, IWalletAccount } from "@/types/wallet";
import { AztecAccount } from "./AztecAccount";
import type {
  AztecWalletConfig,
  AztecAccountData,
  CreateAccountOptions,
} from "./types";
import {
  Fr,
  createLogger,
  createPXEClient,
  createAztecNodeClient,
  waitForPXE,
  AztecAddress,
  getContractInstanceFromInstantiationParams,
  ContractFunctionInteraction,
  SponsoredFeePaymentMethod,
  AuthWitness,
  type PXE,
  AccountWallet,
  GrumpkinScalar,
} from '@aztec/aztec.js';
import { createPXEService } from '@aztec/pxe/client/lazy';
import { getPXEServiceConfig } from '@aztec/pxe/config';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { getSchnorrAccount } from '@aztec/accounts/schnorr/lazy';
import {
  type ContractArtifact,
  getDefaultInitializer,
} from '@aztec/stdlib/abi';
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { TokenContract } from "@/lib/contracts/Token";
import { BetVaultContract } from "@/lib/contracts/BetVault";
import { WormholeContract } from "@/lib/contracts/Wormhole";
import { createStore } from "@aztec/kv-store/indexeddb";
import { pxeService } from "@/services/pxeService";

const LOCAL_STORAGE_KEY = "aztec-account";
const DEFAULT_NODE_URL = "http://localhost:8080";

const logger = createLogger('wallet');


export class AztecWalletProvider implements IExtendedWalletProvider {
  private pxe!: PXE;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private aztecNode: any = null; // AztecNode client for fetching contract instances
  private connectedAccount: AccountWallet | null = null;
  private config: AztecWalletConfig;

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

  private isTestnet(nodeUrl: string): boolean {
    return nodeUrl.includes('aztec-testnet') ||
           (nodeUrl.includes('testnet') &&
           !nodeUrl.includes('localhost') &&
           !nodeUrl.includes('127.0.0.1'));
  }

  async initialize(): Promise<void> {
    if (this.pxe) {
      return;
    }

    const nodeUrl = this.config.nodeUrl || DEFAULT_NODE_URL;
    const isTestnet = this.isTestnet(nodeUrl);

    if (isTestnet) {
      // Testnet: Create local PXE in browser (like aztec-web-starter)
      logger.info('Creating PXE service in browser for testnet:', nodeUrl);

      this.aztecNode = await createAztecNodeClient(nodeUrl);

      const config = getPXEServiceConfig();
      config.l1Contracts = await this.aztecNode.getL1ContractAddresses();
      config.proverEnabled = this.config.proverEnabled;
      const store = await createStore("pxe_data", {
        dataDirectory: "pxe",
        dataStoreMapSizeKB: 1e6,
      });
      this.pxe = await createPXEService(this.aztecNode, config, {
        useLogSuffix: true,
        store
      });

      // Register PXE in global service for access by other providers
      pxeService.registerPXE(this.pxe);

      logger.info('PXE service created in browser');
    } else {
      // Sandbox: Connect to existing PXE HTTP server
      logger.info('Connecting to sandbox PXE:', nodeUrl);
      this.pxe = createPXEClient(nodeUrl);
      await waitForPXE(this.pxe);

      // Register PXE in global service for access by other providers
      pxeService.registerPXE(this.pxe);
    }

    // Register Sponsored FPC Contract with PXE
    await this.pxe.registerContract({
      instance: await this.#getSponsoredFPCContract(),
      artifact: SponsoredFPCContractArtifact,
    });

    // Register deployed contracts from environment variables
    await this.registerDeployedContracts();

    // Log the Node Info
    const nodeInfo = await this.pxe.getNodeInfo();
    logger.info('PXE initialized. Node info:', nodeInfo);
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

    // Register Wormhole contract if address is available
    const wormholeAddress = process.env.NEXT_PUBLIC_WORMHOLE_CONTRACT_ADDRESS;
    console.log('🔵 [REGISTER] Wormhole address from env:', wormholeAddress);

    if (wormholeAddress) {
      try {
        logger.info('Registering Wormhole contract:', wormholeAddress);
        const wormholeAztecAddress = AztecAddress.fromString(wormholeAddress);
        console.log('🔵 [REGISTER] Wormhole AztecAddress parsed:', wormholeAztecAddress.toString());

        // Use aztecNode.getContract() for testnet
        console.log('🔵 [REGISTER] Fetching Wormhole instance from Aztec node...');
        const contractInstance = await this.aztecNode.getContract(wormholeAztecAddress);
        console.log('🔵 [REGISTER] Wormhole instance result:', contractInstance);

        if (contractInstance) {
          console.log('🔵 [REGISTER] Registering Wormhole with PXE...');
          await this.pxe.registerContract({
            instance: contractInstance,
            artifact: WormholeContract.artifact,
          });
          logger.info('✅ Wormhole contract registered successfully');
          console.log('🔵 [REGISTER] ✅ Wormhole registration complete');
        } else {
          logger.warn('⚠️  Wormhole contract instance not found on node');
          console.log('🔵 [REGISTER] ⚠️  Wormhole contractInstance is null/undefined');
        }
      } catch (error) {
        console.error('🔴 [REGISTER] Wormhole registration error:', error);
        logger.warn('Failed to register Wormhole contract (may already be registered or not deployed):', error);
      }
    } else {
      console.log('🔵 [REGISTER] No wormhole address in env, skipping');
    }

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

  async connect(): Promise<IWalletAccount> {
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
      const signingKeyBuffer = Buffer.from(parsed.signingKey, 'hex');
      const signingPrivateKey = GrumpkinScalar.fromBuffer(signingKeyBuffer);
      const ecdsaAccount = await getSchnorrAccount(
            this.pxe,
            Fr.fromString(parsed.secretKey),
            signingPrivateKey,
            Fr.fromString(parsed.salt)
          )

      await ecdsaAccount.register();
      const wallet = await ecdsaAccount.getWallet();

      this.connectedAccount = wallet;
      return new AztecAccount(wallet);
    } catch (error) {
      throw new Error(`Failed to connect to existing account: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      const account = await getSchnorrAccount(this.pxe, secretKey, signingKey, salt);

      const deployMethod = await account.getDeployMethod();
      const sponsoredPFCContract = await this.#getSponsoredFPCContract();

      // Get current block number and set expiration well into the future
      const nodeInfo = await this.pxe.getNodeInfo();
      const currentBlockNumber = nodeInfo.getBlockNumber;
      const expirationBlockNumber = currentBlockNumber + 100; // 100 blocks in the future

      const deployOpts = {
        from: AztecAddress.ZERO,
        contractAddressSalt: Fr.fromString(account.salt.toString()),
        fee: {
          paymentMethod: await account.getSelfPaymentMethod(
            new SponsoredFeePaymentMethod(sponsoredPFCContract.address)
          ),
        },
        expirationBlockNumber,
        universalDeploy: true,
        skipClassPublication: true,
        skipInstancePublication: true,
      };

      const provenInteraction = await deployMethod.prove(deployOpts);
      const receipt = await provenInteraction.send().wait({ timeout: 120 });

      logger.info('Account deployed', receipt);

      const wallet = await account.getWallet();
      const signingKeyHex = signingKey.toBuffer().toString('hex');

      if (saveToStorage) {
        const accountData: AztecAccountData = {
          address: wallet.getAddress().toString(),
          signingKey: signingKeyHex,
          secretKey: secretKey.toString(),
          salt: salt.toString(),
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(accountData));
      }

      await account.register();
      this.connectedAccount = wallet;

      return new AztecAccount(wallet);
    } catch (error) {
      throw new Error(`Failed to create account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  disconnect(): void {
    this.connectedAccount = null;
    // Don't clear PXE on disconnect, it can be reused
  }

  clearAccount(): void {
    this.connectedAccount = null;
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    // Clear PXE when clearing account completely
    pxeService.clearPXE();
  }

  getAccount(): IWalletAccount | null {
    if (!this.connectedAccount) {
      return null;
    }
    return new AztecAccount(this.connectedAccount);
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

    const sponsoredPFCContract = await this.#getSponsoredFPCContract();

    // Get current block number and set expiration well into the future
    const nodeInfo = await this.pxe.getNodeInfo();
    const currentBlockNumber = nodeInfo.blockNumber;
    const expirationBlockNumber = currentBlockNumber + 100; // 100 blocks in the future

    const provenInteraction = await contractInteraction.prove({
      from: from ?? this.connectedAccount.getAddress(),
      fee: {
        paymentMethod: new SponsoredFeePaymentMethod(
          sponsoredPFCContract.address
        ),
      },
      expirationBlockNumber,
    });

    await provenInteraction.send().wait({ timeout: 120 });
  }

  async simulateTransaction(interaction: unknown): Promise<unknown> {
    if (!this.connectedAccount) {
      throw new Error("No account connected. Please connect an account first.");
    }

    const contractInteraction = interaction as ContractFunctionInteraction;
    const res = await contractInteraction.simulate({
      from: this.connectedAccount.getAddress(),
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