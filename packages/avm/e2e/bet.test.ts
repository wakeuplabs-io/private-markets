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
  placeBet,
  setPrivateAuthWit,
  setupPXE,
  toBigInt,
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
  let store: AztecLmdbStore;

  let wallets: AccountWalletWithSecretKey[];

  let alice: AccountWalletWithSecretKey;
  let bob: AccountWalletWithSecretKey;
  let carl: AccountWalletWithSecretKey;

  let vault: BetVaultContract;
  let token: TokenContract;
  let wormholeAddress: AztecAddress;
  let admin: AccountWalletWithSecretKey;

  beforeAll(async () => {
    ({ store, wallets } = await setupTestSuite());
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

  it('deploys vault and token correctly', async () => {
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
    const outcome = 1n;
    const commitment = Fr.random();
    const betId = Fr.random();
    const authwitNonce = Fr.random();

    const isProcessedBefore = await vault.methods
      .is_processed(betId)
      .simulate({ from: alice.getAddress() });
    expect(isProcessedBefore).toBe(false);

    const { tx } = await placeBet(vault, token, alice, admin, AMOUNT, {
      marketId,
      outcome,
      commitment,
      betId,
      authwitNonce,
    });

    expect(tx.status).toBe(TxStatus.SUCCESS);
    await token.methods.sync_private_state().simulate({ from: alice.getAddress() });
    await token.methods.sync_private_state().simulate({ from: admin.getAddress() });

    const isProcessedAfter = await vault.methods
      .is_processed(betId)
      .simulate({ from: alice.getAddress() });
    expect(isProcessedAfter).toBe(true);
    await expectTokenBalances(token, alice, 0, 0);
    await expectTokenBalances(token, admin, 0, AMOUNT);
  }, 300_000);

  it.only('should retrieve user bets with getMyBets', async () => {
    await token
      .withWallet(alice)
      .methods.mint_to_private(alice.getAddress(), alice.getAddress(), AMOUNT)
      .send({ from: alice.getAddress() })
      .wait();

    await expectTokenBalances(token, alice, 0, AMOUNT);

    const { tx, marketId, outcome, commitment, betId } = await placeBet(
      vault,
      token,
      alice,
      admin,
      AMOUNT,
    );

    expect(tx.status).toBe(TxStatus.SUCCESS);

    const aliceBets = await vault.methods.getMyBets(alice.getAddress(), 0, 10).simulate({ from: alice.getAddress() });

    console.log('Alice bets:', aliceBets);
    expect(aliceBets.len).toBe(1n);
    expect(aliceBets.storage[0].owner).toEqual(alice.getAddress());
    expect(aliceBets.storage[0].market_id).toEqual(toBigInt(marketId));
    expect(aliceBets.storage[0].outcome).toBe(outcome);
    expect(aliceBets.storage[0].amount).toBe(toBigInt(AMOUNT));
    expect(aliceBets.storage[0].bet_id).toEqual(toBigInt(betId));
    expect(aliceBets.storage[0].commitment).toEqual(toBigInt(commitment));

    const aliceBetsByBob = await vault.methods.getMyBets(alice.getAddress(), 0, 10).simulate({ from: bob.getAddress() });
    expect(aliceBetsByBob.len).toBe(0n);

  }, 300_000);


  it('should retrieve user bets with pagination', async () => {
    await token
      .withWallet(alice)
      .methods.mint_to_private(alice.getAddress(), alice.getAddress(), AMOUNT * 11n)
      .send({ from: alice.getAddress() })
      .wait();

    await expectTokenBalances(token, alice, 0, AMOUNT * 11n);

    for (let i = 0; i < 11; i++) {
      const { tx } = await placeBet(vault, token, alice, admin, AMOUNT);
      expect(tx.status).toBe(TxStatus.SUCCESS);
    }

    const firstPage = await vault.methods.getMyBets(alice.getAddress(), 0, 10).simulate({ from: alice.getAddress() });
    expect(firstPage.len).toBe(10n);

    const secondPage = await vault.methods.getMyBets(alice.getAddress(), 10, 10).simulate({ from: alice.getAddress() });
    expect(secondPage.len).toBe(1n);
  }, 300_000);
});
