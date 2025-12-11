import { Fr } from '@aztec/aztec.js/fields';
import { UniqueNote } from '@aztec/aztec.js/note';
import { createLogger } from '@aztec/aztec.js/log';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { registerInitialSandboxAccountsInWallet, TestWallet } from '@aztec/test-wallet/server';
import { AuthWitness } from '@aztec/aztec.js/authorization';
import { Contract, DeployOptions, ContractFunctionInteraction } from '@aztec/aztec.js/contracts';
import { poseidon2Hash } from '@aztec/foundation/crypto';

import type { PXE } from '@aztec/pxe/server';
import { createStore } from '@aztec/kv-store/lmdb-v2';
import { getPXEConfig } from '@aztec/pxe/server';
import type { AztecLMDBStoreV2 } from '@aztec/kv-store/lmdb-v2';

import { TokenContract, TokenContractArtifact } from '../artifacts/Token.js';
import { BetVaultContract } from '../artifacts/BetVault.js';

export const logger = createLogger('aztec:aztec-standards');

const { NODE_URL = 'http://localhost:8080' } = process.env;
const node = createAztecNodeClient(NODE_URL);
const { PXE_VERSION = '2' } = process.env;
const pxeVersion = parseInt(PXE_VERSION);

export const setupTestSuite = async () => {
  // Create store for persistent PXE storage
  const store: AztecLMDBStoreV2 = await createStore('pxe', pxeVersion, {
    dataDirectory: 'store',
    dataStoreMapSizeKb: 1e6,
  });

  // Get L1 contracts and PXE config
  const l1Contracts = await node.getL1ContractAddresses();
  const pxeConfig = {
    ...getPXEConfig(),
    l1Contracts,
    proverEnabled: false,
  };

  // Create TestWallet with store - this creates PXE internally
  const wallet: TestWallet = await TestWallet.create(node, pxeConfig, { store });

  // Get PXE from wallet (it's a protected property)
  const pxe: PXE = (wallet as any).pxe;

  // Register sandbox accounts
  const accounts: AztecAddress[] = await registerInitialSandboxAccountsInWallet(wallet);

  return {
    pxe,
    store,
    wallet,
    accounts,
  };
};

// --- Token Utils ---
export const expectUintNote = (note: UniqueNote, amount: bigint, owner: AztecAddress) => {
  expect(note.note.items[0]).toEqual(new Fr(owner.toBigInt()));
  expect(note.note.items[2]).toEqual(new Fr(amount));
};

export const expectTokenBalances = async (
  token: TokenContract,
  address: AztecAddress | { getAddress: () => AztecAddress },
  publicBalance: bigint | number | Fr,
  privateBalance: bigint | number | Fr,
  caller?: TestWallet,
) => {
  const aztecAddress = address instanceof AztecAddress ? address : address.getAddress();
  logger.info('checking balances for', aztecAddress.toString());
  const t = caller ? token.withWallet(caller) : token;

  // Helper to cast to bigint if not already
  const toBigInt = (val: bigint | number | Fr) => {
    if (typeof val === 'bigint') return val;
    if (typeof val === 'number') return BigInt(val);
    if (val instanceof Fr) return val.toBigInt();
    throw new Error('Unsupported type for balance');
  };
  console.log('publicBalance', await t.methods.balance_of_public(aztecAddress).simulate({ from: aztecAddress }));
  console.log('privateBalance', await t.methods.balance_of_private(aztecAddress).simulate({ from: aztecAddress }));
  console.log('publicBalance', toBigInt(publicBalance));
  console.log('privateBalance', toBigInt(privateBalance));
  expect(await t.methods.balance_of_public(aztecAddress).simulate({ from: aztecAddress })).toBe(
    toBigInt(publicBalance),
  );
  expect(await t.methods.balance_of_private(aztecAddress).simulate({ from: aztecAddress })).toBe(
    toBigInt(privateBalance),
  );
};

export const AMOUNT = 1000n;
export const wad = (n: number = 1) => AMOUNT * BigInt(n);

/**
 * Deploys the Token contract with a specified minter.
 * @param wallet - The wallet to deploy the contract with.
 * @param deployer - The account to deploy the contract with.
 * @returns A deployed contract instance.
 */
export async function deployTokenWithMinter(wallet: Wallet, deployer: AztecAddress, options?: DeployOptions) {
  const contract = await Contract.deploy(
    wallet,
    TokenContractArtifact,
    ['PrivateToken', 'PT', 18, deployer, AztecAddress.ZERO],
    'constructor_with_minter',
  )
    .send({ ...options, from: deployer })
    .deployed();
  return contract;
}

/**
 * Deploys the Token contract with a specified initial supply.
 * @param wallet - The wallet to deploy the contract with.
 * @param deployer - The account to deploy the contract with.
 * @returns A deployed contract instance.
 */
export async function deployTokenWithInitialSupply(wallet: Wallet, deployer: AztecAddress, options?: DeployOptions) {
  const contract = await Contract.deploy(
    wallet,
    TokenContractArtifact,
    ['PrivateToken', 'PT', 18, 0, deployer, deployer],
    'constructor_with_initial_supply',
  )
    .send({ ...options, from: deployer })
    .deployed();
  return contract;
}

export async function setPrivateAuthWit(
  caller: AztecAddress,
  action: ContractFunctionInteraction,
  authorizer: AztecAddress,
  wallet: Wallet,
): Promise<AuthWitness> {
  // In v3.0.0, createAuthWit takes the authorizer and an intent object with caller and action
  return wallet.createAuthWit(
    authorizer,
    { caller, action } as any  // Type assertion needed due to API changes
  );
}

export async function setPublicAuthWit(
  caller: AztecAddress,
  action: ContractFunctionInteraction,
  authorizer: AztecAddress,
  wallet: TestWallet,
) {
  const validateAction = await wallet.setPublicAuthWit(
    authorizer,
    { caller, action } as any,  // Type assertion needed due to API changes
    true,
  );
  await validateAction.send().wait();
}


/**
 * Places a bet on the vault with optional parameters.
 * @param vault - The BetVault contract instance.
 * @param token - The Token contract instance.
 * @param better - The address placing the bet.
 * @param admin - The admin address that will receive the tokens.
 * @param amount - The amount to bet.
 * @param wallet - The wallet instance for creating auth witnesses.
 * @param options - Optional parameters (marketId, outcome, commitment, betId, authwitNonce, secret).
 * @returns The transaction receipt and bet details including secret.
 */
export async function placeBet(
  vault: BetVaultContract,
  token: TokenContract,
  better: AztecAddress,
  admin: AztecAddress,
  amount: bigint,
  wallet: Wallet,
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
    // Generate realistic params with proper commitment = poseidon2Hash([marketId, amount, secret])
    const params = await generateBetParams(options?.marketId, amount);
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
    better,
    admin,
    amount,
    authwitNonce,
  );

  const witness = await setPrivateAuthWit(vault.address, transferAction, better, wallet);
  console.log({
    marketId,
    outcome,
    amount,
    commitment,
    betId,
    authwitNonce,
    from:better,
  })
  const betTx = await vault
    .methods.bet(
      marketId,
      outcomeU8,
      amount,
      commitment,
      betId,
      authwitNonce,
      better,
    )
    .with({ authWitnesses: [witness] })
    .send({ from: better })
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


/**
 * Truncate a Field to 248 bits (31 bytes) for Wormhole compatibility
 * All IDs sent through Wormhole must fit in 31 bytes
 * @param value - Field value to truncate
 * @returns Truncated Field (guaranteed to fit in 31 bytes)
 */
export function truncateTo248Bits(value: Fr): Fr {
  // Get the 32 bytes of the field (big-endian)
  const bytes = value.toBuffer();
  // Zero out the first byte to get 248 bits (31 bytes)
  bytes[0] = 0;
  return Fr.fromBuffer(bytes);
}

/**
 * Generate a random Field truncated to 248 bits for Wormhole compatibility
 * @returns Random Fr that fits in 31 bytes
 */
export function generateRandom248BitField(): Fr {
  return truncateTo248Bits(Fr.random());
}

/**
 * Generate a random secret for bet commitment
 * Note: Secret is internal to Aztec, doesn't need truncation
 * @returns Random Fr (Field element)
 */
export function generateSecret(): Fr {
  return Fr.random();
}

/**
 * Generate a unique bet ID (truncated to 248 bits for Wormhole)
 * @returns Random Fr that fits in 31 bytes
 */
export function generateBetId(): Fr {
  return generateRandom248BitField();
}

/**
 * Generate a market ID (truncated to 248 bits for Wormhole)
 * @returns Random Fr that fits in 31 bytes
 */
export function generateMarketId(): Fr {
  return generateRandom248BitField();
}

/**
 * Generate an authwit nonce for transaction authorization
 * Note: Nonce is internal to Aztec, doesn't need truncation
 * @returns Random Fr
 */
export function generateAuthwitNonce(): Fr {
  return Fr.random();
}

/**
 * Generate commitment: poseidon2_hash([market_id, amount, secret])
 * Matches contract logic in packages/avm/vault/src/main.nr
 * @param marketId - Market identifier
 * @param amount - Bet amount (must match actual bet amount)
 * @param secret - Random secret
 * @returns Commitment as Fr
 */
export async function generateCommitment(marketId: Fr, amount: bigint, secret: Fr): Promise<Fr> {
  return await poseidon2Hash([marketId, new Fr(amount), secret]);
}
/**
 * Compute nullifier: poseidon2_hash([market_id, commitment, recipient])
 * Then truncate to 248 bits for Wormhole compatibility
 * Matches contract logic in packages/avm/vault/src/main.nr
 * @param marketId - Market identifier
 * @param commitment - Bet commitment
 * @param recipient - Recipient address as Field
 * @returns Nullifier as Fr (truncated to 248 bits)
 */
export async function computeNullifier(
  marketId: Fr,
  commitment: Fr,
  recipient: Fr
): Promise<Fr> {
  const hash = await poseidon2Hash([marketId, commitment, recipient]);
  return truncateTo248Bits(hash);
}

/**
 * Generate realistic bet parameters
 * Creates a proper commitment from marketId, amount, and secret
 * All IDs are truncated to 248 bits for Wormhole compatibility
 * @param marketId - Optional market ID (generated if not provided, will be truncated)
 * @param amount - Bet amount (defaults to AMOUNT constant)
 * @returns Object with all bet parameters including secret for claiming
 */
export async function generateBetParams(marketId?: Fr, amount: bigint = AMOUNT) {
  // Use provided marketId (truncate if needed) or generate new one
  const market = marketId ? truncateTo248Bits(marketId) : generateMarketId();
  const secret = generateSecret();
  const commitment = await generateCommitment(market, amount, secret);
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
 * Converts various types to bigint
 * Handles Fr, AztecAddress, number, string, and bigint inputs
 */
export function toBigInt(value: any): bigint {
  if (typeof value === 'bigint') {
    return value;
  } else if (typeof value === 'number') {
    return BigInt(value);
  } else if (typeof value === 'string') {
    return BigInt(value);
  } else if (value && typeof value.toBigInt === 'function') {
    // Handles Fr, AztecAddress, and other Aztec types with toBigInt method
    return value.toBigInt();
  } else if (value && typeof value.toString === 'function') {
    // Fallback to toString and convert
    return BigInt(value.toString());
  } else {
    throw new Error(`Cannot convert ${typeof value} to bigint`);
  }
}

/**
 * Safely formats test errors for display, handling BigInt serialization
 */
export function formatTestError(error: any): string {
  if (!error) return 'Unknown error';

  // Handle Jest assertion errors
  if (error.matcherResult) {
    const { actual, expected } = error.matcherResult;
    return `Test Assertion Failed:\n  Expected: ${stringifyValue(expected)}\n  Received: ${stringifyValue(actual)}`;
  }

  // Handle regular errors
  if (error.message) {
    // Replace BigInt values in the message with string representations
    let message = error.message;
    message = message.replace(/(\d+)n/g, '$1n');
    return `Error: ${message}`;
  }

  // Fallback
  return `Error: ${String(error)}`;
}

/**
 * Safely stringify values including BigInt
 */
function stringifyValue(value: any): string {
  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') {
    try {
      // Try to stringify, replacing BigInt values
      const str = JSON.stringify(value, (_, v) =>
        typeof v === 'bigint' ? `${v.toString()}n` : v
      );
      return str;
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Test helper that catches and formats errors properly
 */
export async function runTestStep<T>(
  stepName: string,
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error: any) {
    console.error(`\nFailed at: ${stepName}`);
    console.error(formatTestError(error));

    // Re-throw a sanitized error that Jest can handle
    const sanitizedError = new Error(formatTestError(error));
    if (error && error.stack) {
      sanitizedError.stack = error.stack;
    }
    throw sanitizedError;
  }
}
