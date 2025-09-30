import {
  Fr,
  TxStatus,
  AccountWalletWithSecretKey,
  AztecAddress,
  IntentAction,
} from '@aztec/aztec.js';
import {
  AMOUNT,
  deployVaultWithToken,
  expectTokenBalances,
  setPrivateAuthWit,
  setupPXE,
  wad,
} from './utils.js';
import { PXE } from '@aztec/stdlib/interfaces/client';
import { AztecLmdbStore } from '@aztec/kv-store/lmdb';
import { getInitialTestAccountsManagers } from '@aztec/accounts/testing';
import { TokenContract } from '../artifacts/Token.js';
import { BetVaultContract } from '../artifacts/BetVault.js';

const setupTestSuite = async () => {
  const { pxe, store } = await setupPXE();
  const managers = await getInitialTestAccountsManagers(pxe);
  const wallets = await Promise.all(managers.map((acc) => acc.register()));
  const [deployer] = wallets;

  return { pxe, store, deployer, wallets };
};

describe('BetVault - E2E Tests', () => {
  let pxe: PXE;
  let store: AztecLmdbStore;

  let wallets: AccountWalletWithSecretKey[];
  let deployer: AccountWalletWithSecretKey;

  let alice: AccountWalletWithSecretKey;
  let bob: AccountWalletWithSecretKey;
  let carl: AccountWalletWithSecretKey;

  let vault: BetVaultContract;
  let token: TokenContract;
  let wormholeAddress: AztecAddress;
  let admin: AccountWalletWithSecretKey;

  beforeAll(async () => {
    ({ pxe, store, deployer, wallets } = await setupTestSuite());
    [alice, bob, carl] = wallets;
    admin = bob;
    wormholeAddress = await AztecAddress.random();
  });

  beforeEach(async () => {
    [vault, token] = await deployVaultWithToken(alice, wormholeAddress, admin.getAddress());
  });

  afterAll(async () => {
    await store.delete();
  });

  it.skip('deploys vault and token correctly', async () => {
    expect(vault.address).toBeDefined();
    expect(token.address).toBeDefined();

    // Verify token address is correctly set
    const storedTokenAddress = await vault.methods
      .get_token_address()
      .simulate({ from: alice.getAddress() });
    expect(storedTokenAddress).toEqual(token.address);

    // Verify admin address is correctly set
    const storedAdminAddress = await vault.methods
      .get_admin()
      .simulate({ from: alice.getAddress() });
    expect(storedAdminAddress).toEqual(admin.getAddress());

    const mintTx = await token
      .withWallet(alice)
      .methods.mint_to_public(alice.getAddress(), AMOUNT)
      .send({ from: alice.getAddress() })
      .wait();

    expect(mintTx.status).toBe(TxStatus.SUCCESS);

    const balance = await token.methods
      .balance_of_public(alice.getAddress())
      .simulate({ from: alice.getAddress() });

    expect(balance).toBe(AMOUNT);
  }, 300_000);

  it('places a bet and marks it as processed', async () => {
    await token
      .withWallet(alice)
      .methods.mint_to_private(alice.getAddress(), alice.getAddress(), AMOUNT)
      .send({ from: alice.getAddress() })
      .wait();

    await expectTokenBalances(token, alice, 0, AMOUNT);

    const marketId = Fr.random();
    const outcome = 1;
    const commitment = Fr.random();
    const betId = Fr.random();
    const authwitNonce = Fr.random();

    const mockMsg: bigint[][] = Array(7).fill(Array(31).fill(0n));

    const isProcessedBefore = await vault.methods
      .is_processed(betId)
      .simulate({ from: alice.getAddress() });
    expect(isProcessedBefore).toBe(false);

    const transferAction = token
      .methods.transfer_private_to_private(
        alice.getAddress(),
        admin.getAddress(),
        AMOUNT,
        authwitNonce
      );

    const witness = await setPrivateAuthWit(vault.address, transferAction, alice);

    const betTx = await vault
      .withWallet(alice)
      .methods.bet(
        marketId,
        outcome,
        AMOUNT,
        commitment,
        betId,
        authwitNonce,
        alice.getAddress(),
        mockMsg
      )
      .with({ authWitnesses: [witness] })
      .send({ from: alice.getAddress() })
      .wait();

    expect(betTx.status).toBe(TxStatus.SUCCESS);
    await token.methods.sync_private_state().simulate({ from: alice.getAddress() });
    await token.methods.sync_private_state().simulate({ from: admin.getAddress() });

    const isProcessedAfter = await vault.methods
      .is_processed(betId)
      .simulate({ from: alice.getAddress() });
    expect(isProcessedAfter).toBe(true);
    console.log('------FINAL BALANCES------');
    await expectTokenBalances(token, alice, 0, 0);
    await expectTokenBalances(token, admin, 0, AMOUNT);
  }, 300_000);
});
