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
  waitForPXE,
  AztecAddress,
  getContractInstanceFromInstantiationParams,
  ContractFunctionInteraction,
  SponsoredFeePaymentMethod,
  type PXE,
  AccountWallet,
  GrumpkinScalar,
} from '@aztec/aztec.js';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { getSchnorrAccount } from '@aztec/accounts/schnorr/lazy';
import {
  type ContractArtifact,
  getDefaultInitializer,
} from '@aztec/stdlib/abi';
import { getInitialTestAccounts } from '@aztec/accounts/testing';

const LOCAL_STORAGE_KEY = "aztec-account";
const DEFAULT_NODE_URL = "http://localhost:8080";

const logger = createLogger('wallet');


export class AztecWalletProvider implements IExtendedWalletProvider {
  private pxe!: PXE;
  private connectedAccount: AccountWallet | null = null;
  private config: AztecWalletConfig;

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

  async initialize(): Promise<void> {
    if (this.pxe) {
      return;
    }

    // Create PXE Client (browser-compatible)
    const nodeUrl = this.config.nodeUrl || DEFAULT_NODE_URL;
    this.pxe = createPXEClient(nodeUrl);
    await waitForPXE(this.pxe);

    // Register Sponsored FPC Contract with PXE
    await this.pxe.registerContract({
      instance: await this.#getSponsoredFPCContract(),
      artifact: SponsoredFPCContractArtifact,
    });

    // Log the Node Info
    const nodeInfo = await this.pxe.getNodeInfo();
    logger.info('PXE Connected to node', nodeInfo);
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
      const signingKey = GrumpkinScalar.random();

      const account = await getSchnorrAccount(this.pxe, secretKey, signingKey, salt);

      const deployMethod = await account.getDeployMethod();
      const sponsoredPFCContract = await this.#getSponsoredFPCContract();
      const deployOpts = {
        from: AztecAddress.ZERO,
        contractAddressSalt: Fr.fromString(account.salt.toString()),
        fee: {
          paymentMethod: await account.getSelfPaymentMethod(
            new SponsoredFeePaymentMethod(sponsoredPFCContract.address)
          ),
        },
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
        console.log(`[AztecWalletProvider] Account data saved to localStorage`);
      }

      // Register the account with PXE
      await account.register();
      this.connectedAccount = wallet;

      return new AztecAccount(wallet);
    } catch (error) {
      throw new Error(`Failed to create account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async connectTestAccount(index: number): Promise<IWalletAccount> {
    await this.initialize();

    try {
      const testAccounts = await getInitialTestAccounts();

      if (index < 0 || index >= testAccounts.length) {
        throw new Error(`Test account index ${index} is out of range. Available: 0-${testAccounts.length - 1}`);
      }

      const account = testAccounts[index];
      const schnorrAccount = await getSchnorrAccount(
        this.pxe,
        account.secret,
        account.signingKey,
        account.salt
      );

      await schnorrAccount.register();
      const wallet = await schnorrAccount.getWallet();

      console.log(`[AztecWalletProvider] Connected to test account ${index}: ${wallet.getAddress().toString()}`);

      this.connectedAccount = wallet;
      return new AztecAccount(wallet);
    } catch (error) {
      throw new Error(`Failed to connect test account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  disconnect(): void {
    this.connectedAccount = null;
    console.log(`[AztecWalletProvider] Disconnected (account data preserved in localStorage)`);
  }

  clearAccount(): void {
    this.connectedAccount = null;
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    console.log(`[AztecWalletProvider] Account cleared from localStorage`);
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

  async sendTransaction(interaction: unknown): Promise<void> {
    if (!this.connectedAccount) {
      throw new Error("No account connected. Please connect an account first.");
    }

    const contractInteraction = interaction as ContractFunctionInteraction;
    const sponsoredPFCContract = await this.#getSponsoredFPCContract();
    const provenInteraction = await contractInteraction.prove({
      from: this.connectedAccount.getAddress(),
      fee: {
        paymentMethod: new SponsoredFeePaymentMethod(
          sponsoredPFCContract.address
        ),
      },
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