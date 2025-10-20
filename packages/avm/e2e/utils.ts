import {
  createLogger,
  Fr,
  AztecAddress,
  UniqueNote,
  AccountWallet,
  Contract,
  DeployOptions,
  createAztecNodeClient,
  waitForPXE,
  IntentAction,
  Wallet,
  AuthWitness,
  ContractFunctionInteraction,
} from '@aztec/aztec.js';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import { getPXEServiceConfig } from '@aztec/pxe/config';
import { createPXEService } from '@aztec/pxe/server';
import { createStore } from '@aztec/kv-store/lmdb';
import { TokenContract, TokenContractArtifact } from '../artifacts/Token.js';
import { BetVaultContract, BetVaultContractArtifact } from '../artifacts/BetVault.js';

export const logger = createLogger('aztec:aztec-standards');

const { NODE_URL = 'http://localhost:8080' } = process.env;
const node = createAztecNodeClient(NODE_URL);
const l1Contracts = await node.getL1ContractAddresses();
const config = getPXEServiceConfig();
const fullConfig = { ...config, l1Contracts };
fullConfig.proverEnabled = false;

export const setupPXE = async () => {
  const store = await createStore('pxe', {
    dataDirectory: 'store',
    dataStoreMapSizeKB: 1e6,
  });
  const pxe = await createPXEService(node, fullConfig, { store });
  await waitForPXE(pxe);
  return { pxe, store };
};

// --- Token Utils ---

export const toBigInt = (val: bigint | number | Fr) => {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') return BigInt(val);
  if (val instanceof Fr) return val.toBigInt();
  throw new Error('Unsupported type for balance');
};

export const expectUintNote = (note: UniqueNote, amount: bigint, owner: AztecAddress) => {
  expect(note.note.items[0]).toEqual(new Fr(owner.toBigInt()));
  expect(note.note.items[2]).toEqual(new Fr(amount));
};

export const expectTokenBalances = async (
  token: TokenContract,
  address: AztecAddress | { getAddress: () => AztecAddress },
  publicBalance: bigint | number | Fr,
  privateBalance: bigint | number | Fr,
  caller?: AccountWallet,
) => {
  const aztecAddress = address instanceof AztecAddress ? address : address.getAddress();
  logger.info('checking balances for', aztecAddress.toString());
  const t = caller ? token.withWallet(caller) : token;

  const publicBalanceRetrieved = await t.methods.balance_of_public(aztecAddress).simulate({ from: aztecAddress });
  const privateBalanceRetrieved = await t.methods.balance_of_private(aztecAddress).simulate({ from: aztecAddress });

  expect(publicBalanceRetrieved).toBe(toBigInt(publicBalance));
  expect(privateBalanceRetrieved).toBe(toBigInt(privateBalance));

};

export const AMOUNT = 1000n;
export const wad = (n: number = 1) => AMOUNT * BigInt(n);

// --- Bet Generation Utils (matching frontend implementation) ---

/**
 * Generate a random secret for bet commitment
 * @returns Random Fr (Field element)
 */
export function generateSecret(): Fr {
  return Fr.random();
}

/**
 * Generate a unique bet ID
 * @returns Random Fr (must be unique per bet)
 */
export function generateBetId(): Fr {
  return Fr.random();
}

/**
 * Generate an authwit nonce for transaction authorization
 * @returns Random Fr
 */
export function generateAuthwitNonce(): Fr {
  return Fr.random();
}

/**
 * Generate commitment: poseidon2_hash([market_id, secret])
 * Matches contract logic in packages/avm/vault/src/main.nr
 * @param marketId - Market identifier
 * @param secret - Random secret
 * @returns Commitment as Fr
 */
export async function generateCommitment(marketId: Fr, secret: Fr): Promise<Fr> {
  return await poseidon2Hash([marketId, secret]);
}

/**
 * Compute nullifier: poseidon2_hash([market_id, commitment, recipient])
 * Matches contract logic in packages/avm/vault/src/main.nr
 * @param marketId - Market identifier
 * @param commitment - Bet commitment
 * @param recipient - Recipient address as Field
 * @returns Nullifier as Fr
 */
export async function computeNullifier(
  marketId: Fr,
  commitment: Fr,
  recipient: Fr
): Promise<Fr> {
  return await poseidon2Hash([marketId, commitment, recipient]);
}

/**
 * Generate realistic bet parameters
 * Creates a proper commitment from marketId and secret
 * @param marketId - Optional market ID (generated if not provided)
 * @returns Object with all bet parameters including secret for claiming
 */
export async function generateBetParams(marketId?: Fr) {
  const market = marketId ?? Fr.random();
  const secret = generateSecret();
  const commitment = await generateCommitment(market, secret);
  const betId = generateBetId();
  const authwitNonce = generateAuthwitNonce();
  const outcome = 1n; // YES

  return {
    marketId: market,
    secret,
    commitment,
    betId,
    authwitNonce,
    outcome,
  };
}

/**
 * Deploys the Token contract with a specified minter.
 * @param deployer - The wallet to deploy the contract with.
 * @returns A deployed contract instance.
 */
export async function deployTokenWithMinter(deployer: Wallet, options?: DeployOptions) {
  const contract = await Contract.deploy(
    deployer,
    TokenContractArtifact,
    ['PrivateToken', 'PT', 18, deployer.getAddress(), AztecAddress.ZERO],
    'constructor_with_minter',
  )
    .send({ ...options, from: deployer.getAddress() })
    .deployed();
  return contract;
}

export async function deployTokenWithInitialSupply(deployer: AccountWallet) {
  const contract = await Contract.deploy(
    deployer,
    TokenContractArtifact,
    ['PrivateToken', 'PT', 18, 0, deployer.getAddress(), deployer.getAddress()],
    'constructor_with_initial_supply',
  )
    .send({ from: deployer.getAddress() })
    .deployed();
  return contract;
}

/**
 * Deploys the BetVault contract with a token asset.
 * @param deployer - The wallet to deploy the contract with.
 * @param wormholeAddress - The address of the Wormhole contract.
 * @param adminAddress - The admin address that will custody the funds.
 * @returns A tuple with [vaultContract, tokenContract].
 */
export async function deployVaultWithToken(
  deployer: AccountWallet,
  wormholeAddress: AztecAddress,
  adminAddress: AztecAddress,
): Promise<[BetVaultContract, TokenContract]> {
  // Deploy token with deployer as minter
  const tokenContract = (await deployTokenWithMinter(deployer, {
    from: deployer.getAddress(),
  })) as TokenContract;

  // Deploy BetVault with token, wormhole, and admin addresses
  const vaultContract = await Contract.deploy(
    deployer,
    BetVaultContractArtifact,
    [tokenContract.address, wormholeAddress, adminAddress],
    'constructor',
  )
    .send({ from: deployer.getAddress() })
    .deployed();

  return [vaultContract as BetVaultContract, tokenContract];
}

export async function setPrivateAuthWit(
  caller: AztecAddress | { getAddress: () => AztecAddress },
  action: ContractFunctionInteraction,
  account: AccountWallet,
): Promise<AuthWitness> {
  const callerAddress = caller instanceof AztecAddress ? caller : caller.getAddress();

  const intent: IntentAction = {
    caller: callerAddress,
    action: action,
  };
  return account.createAuthWit(intent);
}

export async function setPublicAuthWit(
  caller: AztecAddress | { getAddress: () => AztecAddress },
  action: ContractFunctionInteraction,
  account: AccountWallet,
) {
  const callerAddress = caller instanceof AztecAddress ? caller : caller.getAddress();

  const intent: IntentAction = {
    caller: callerAddress,
    action: action,
  };
  await account.createAuthWit(intent);
  await (await account.setPublicAuthWit(intent, true)).send({ from: account.getAddress() }).wait();
}

/**
 * Places a bet on the vault with optional parameters.
 * @param vault - The BetVault contract instance.
 * @param token - The Token contract instance.
 * @param better - The wallet placing the bet.
 * @param admin - The admin wallet that will receive the tokens.
 * @param amount - The amount to bet.
 * @param options - Optional parameters (marketId, outcome, commitment, betId, authwitNonce, secret).
 * @returns The transaction receipt and bet details including secret.
 */
export async function placeBet(
  vault: BetVaultContract,
  token: TokenContract,
  better: AccountWallet,
  admin: AccountWallet,
  amount: bigint,
  options?: {
    marketId?: Fr;
    outcome?: bigint;
    commitment?: Fr;
    betId?: Fr;
    authwitNonce?: Fr;
    secret?: Fr;
  },
) {
  // Generate realistic bet params if not provided
  let marketId: Fr;
  let outcome: bigint;
  let commitment: Fr;
  let betId: Fr;
  let authwitNonce: Fr;
  let secret: Fr;

  if (options?.commitment && options?.secret && options?.marketId) {
    // If commitment and secret are both provided, use them directly
    marketId = options.marketId;
    secret = options.secret;
    commitment = options.commitment;
    outcome = options.outcome ?? 1n;
    betId = options.betId ?? generateBetId();
    authwitNonce = options.authwitNonce ?? generateAuthwitNonce();
  } else {
    // Generate realistic params with proper commitment = poseidon2Hash([marketId, secret])
    const params = await generateBetParams(options?.marketId);
    marketId = params.marketId;
    secret = params.secret;
    commitment = params.commitment;
    betId = options?.betId ?? params.betId;
    authwitNonce = options?.authwitNonce ?? params.authwitNonce;
    outcome = options?.outcome ?? params.outcome;
  }
  // Convert outcome to u8 (must be 0 or 1)
  const outcomeU8 = Number(outcome);
  if (outcomeU8 !== 0 && outcomeU8 !== 1) {
    throw new Error(`Invalid outcome: ${outcomeU8}. Must be 0 or 1`);
  }

  // Ensure amount is within u128 bounds and positive
  if (amount <= 0n) {
    throw new Error(`Amount must be positive, got: ${amount}`);
  }
  const MAX_U128 = (1n << 128n) - 1n;
  if (amount > MAX_U128) {
    throw new Error(`Amount exceeds u128 max: ${amount}`);
  }

  const transferAction = token.methods.transfer_private_to_private(
    better.getAddress(),
    admin.getAddress(),
    amount,
    authwitNonce,
  );

  const witness = await setPrivateAuthWit(vault.address, transferAction, better);
  console.log({
    marketId,
    outcome,
    amount,
    commitment,
    betId,
    authwitNonce,
    from:better.getAddress(),
  })
  const betTx = await vault
    .withWallet(better)
    .methods.bet(
      marketId,
      outcomeU8,
      amount,
      commitment,
      betId,
      authwitNonce,
      better.getAddress(),
    )
    .with({ authWitnesses: [witness] })
    .send({ from: better.getAddress() })
    .wait();

  return {
    tx: betTx,
    marketId,
    outcome,
    commitment,
    betId,
    authwitNonce,
    secret,
  };
}
