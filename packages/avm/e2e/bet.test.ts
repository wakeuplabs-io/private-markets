
import {
  TxStatus,
  AccountWalletWithSecretKey,
  AztecAddress,
  Fr,
} from '@aztec/aztec.js';
import {
  AMOUNT,
  deployVaultWithToken,
  expectTokenBalances,
  placeBet,
  setupPXE,
  toBigInt,
  generateBetParams,
  generateCommitment,
  computeNullifier,
} from './utils.js';
import { AztecLmdbStore } from '@aztec/kv-store/lmdb';
import { getInitialTestAccountsManagers } from '@aztec/accounts/testing';
import { TokenContract } from '../artifacts/Token.js';
import { BetVaultContract } from '../artifacts/BetVault.js';
import { poseidon2Hash } from "@aztec/foundation/crypto";

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

  let vault: BetVaultContract;
  let token: TokenContract;
  let wormholeAddress: AztecAddress;
  let admin: AccountWalletWithSecretKey;

  beforeAll(async () => {
    ({ store, wallets } = await setupTestSuite());
    [alice, bob] = wallets;
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

  it.skip('places a bet and marks it as processed', async () => {
    await token
      .withWallet(alice)
      .methods.mint_to_private(alice.getAddress(), alice.getAddress(), AMOUNT)
      .send({ from: alice.getAddress() })
      .wait();

    await expectTokenBalances(token, alice, 0, AMOUNT);

    // Generate realistic bet parameters with proper commitment
    const betParams = await generateBetParams();

    const isProcessedBefore = await vault.methods
      .is_processed(betParams.betId)
      .simulate({ from: alice.getAddress() });
    expect(isProcessedBefore).toBe(false);

    const { tx, secret, commitment } = await placeBet(vault, token, alice, admin, AMOUNT, betParams);

    expect(tx.status).toBe(TxStatus.SUCCESS);

    // Verify commitment was calculated correctly from secret and amount
    const expectedCommitment = await generateCommitment(betParams.marketId, AMOUNT, secret);
    expect(commitment.toString()).toBe(expectedCommitment.toString());

    await token.methods.sync_private_state().simulate({ from: alice.getAddress() });
    await token.methods.sync_private_state().simulate({ from: admin.getAddress() });

    const isProcessedAfter = await vault.methods
      .is_processed(betParams.betId)
      .simulate({ from: alice.getAddress() });
    expect(isProcessedAfter).toBe(true);
    await expectTokenBalances(token, alice, 0, 0);
    await expectTokenBalances(token, admin, 0, AMOUNT);
  }, 300_000);

  it.skip('should retrieve user bets with get_user_bets', async () => {
    await token
      .withWallet(alice)
      .methods.mint_to_private(alice.getAddress(), alice.getAddress(), AMOUNT)
      .send({ from: alice.getAddress() })
      .wait();

    await expectTokenBalances(token, alice, 0, AMOUNT);

    // Generate realistic bet parameters
    const { tx, marketId, outcome, commitment, betId, secret } = await placeBet(
      vault,
      token,
      alice,
      admin,
      AMOUNT,
    );

    expect(tx.status).toBe(TxStatus.SUCCESS);

    // Verify commitment is correctly computed from secret and amount
    const expectedCommitment = await generateCommitment(marketId, AMOUNT, secret);
    expect(commitment.toString()).toBe(expectedCommitment.toString());

    const aliceBets = await vault.methods.get_user_bets(alice.getAddress(), 0, 10).simulate({ from: alice.getAddress() });

    expect(aliceBets.len).toBe(1n);
    expect(aliceBets.storage[0].owner).toEqual(alice.getAddress());
    expect(aliceBets.storage[0].market_id).toEqual(toBigInt(marketId));
    expect(aliceBets.storage[0].outcome).toBe(outcome);
    expect(aliceBets.storage[0].amount).toBe(toBigInt(AMOUNT));
    expect(aliceBets.storage[0].bet_id).toEqual(toBigInt(betId));
    expect(aliceBets.storage[0].commitment).toEqual(toBigInt(commitment));

    // Utility function allows to retrieve bets by other accounts
    const aliceBetsByBob = await vault.methods.get_user_bets(alice.getAddress(), 0, 10).simulate({ from: bob.getAddress() });
    expect(aliceBetsByBob.len).toBe(1n);

  }, 300_000);

  it.skip('should retrieve user bets with pagination', async () => {
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

    const firstPage = await vault.methods.get_user_bets(alice.getAddress(), 0, 10).simulate({ from: alice.getAddress() });
    expect(firstPage.len).toBe(10n);

    const secondPage = await vault.methods.get_user_bets(alice.getAddress(), 10, 10).simulate({ from: alice.getAddress() });
    expect(secondPage.len).toBe(1n);
  }, 300_000);

  it('should authorize claim with valid secret and commitment', async () => {
    // Mint tokens to alice
    await token
      .withWallet(alice)
      .methods.mint_to_private(alice.getAddress(), alice.getAddress(), AMOUNT)
      .send({ from: alice.getAddress() })
      .wait();

    await expectTokenBalances(token, alice, 0, AMOUNT);

    // Place a bet with realistic parameters
    const { tx, marketId, commitment, secret } = await placeBet(
      vault,
      token,
      alice,
      admin,
      AMOUNT,
    );

    expect(tx.status).toBe(TxStatus.SUCCESS);

    // Verify commitment was correctly generated from secret and amount
    const expectedCommitment = await generateCommitment(marketId, AMOUNT, secret);
    expect(commitment.toString()).toBe(expectedCommitment.toString());

    // Define recipient for claim (bob's address)
    const recipient = bob.getAddress();
    const recipientField = new Fr(recipient.toBigInt());

    // Calculate expected nullifier
    const expectedNullifier = await computeNullifier(marketId, commitment, recipientField);

    // Check nullifier is not used before claim
    const nullifierUsedBefore = await vault.methods
      .is_nullifier_used(expectedNullifier)
      .simulate({ from: alice.getAddress() });
    expect(nullifierUsedBefore).toBe(false);

    // Check commitment is not claimed before
    const commitmentClaimedBefore = await vault.methods
      .is_commitment_claimed(commitment)
      .simulate({ from: alice.getAddress() });
    expect(commitmentClaimedBefore).toBe(false);
    console.log('✅ Commitment is not claimed before authorization');

    // Step 1: Call find_bet_for_claim to get bet amount (unconstrained pre-flight check)
    const [found, betAmount] = await vault.methods
      .find_bet_for_claim(alice.getAddress(), commitment, marketId)
      .simulate({ from: alice.getAddress() });

    expect(found).toBe(true);
    expect(betAmount).toBe(toBigInt(AMOUNT));

    console.log('Found bet via find_bet_for_claim:', { found, betAmount: betAmount.toString() });

    // Step 2: Authorize claim with the stored secret and bet amount
    const claimAuthwitNonce = Fr.random();

    const authorizeTx = await vault
      .withWallet(alice)
      .methods.authorizeClaim(
        marketId,
        commitment,
        secret,
        recipient,
        betAmount,
        claimAuthwitNonce,
      )
      .send({ from: alice.getAddress() })
      .wait();

    expect(authorizeTx.status).toBe(TxStatus.SUCCESS);

    // Check nullifier is now marked as used
    const nullifierUsedAfter = await vault.methods
      .is_nullifier_used(expectedNullifier)
      .simulate({ from: alice.getAddress() });
    expect(nullifierUsedAfter).toBe(true);

    // Check commitment is NOW claimed after authorization
    const commitmentClaimedAfter = await vault.methods
      .is_commitment_claimed(commitment)
      .simulate({ from: alice.getAddress() });
    expect(commitmentClaimedAfter).toBe(true);
    console.log('Commitment is now marked as claimed after authorization');

    // Verify double-claim prevention
    console.log('Testing double-claim prevention...');
    await expect(async () => {
      await vault
        .withWallet(alice)
        .methods.authorizeClaim(
          marketId,
          commitment,
          secret,
          recipient,
          betAmount,
          Fr.random(),
        )
        .send({ from: alice.getAddress() })
        .wait();
    }).rejects.toThrow();
    console.log('Double-claim correctly prevented: "Commitment already claimed"');

    console.log('Claim authorized successfully!');
    console.log('Nullifier:', expectedNullifier.toString());
    console.log('Market ID:', marketId.toString());
    console.log('Recipient:', recipient.toString());
    console.log('All claim tracking verified via claimed_commitments storage');
  }, 300_000);

  it.skip('should fail to authorize claim with invalid secret', async () => {
    // Mint tokens to alice
    await token
      .withWallet(alice)
      .methods.mint_to_private(alice.getAddress(), alice.getAddress(), AMOUNT)
      .send({ from: alice.getAddress() })
      .wait();

    await expectTokenBalances(token, alice, 0, AMOUNT);

    // Place a bet
    const { tx, marketId, commitment } = await placeBet(
      vault,
      token,
      alice,
      admin,
      AMOUNT,
    );

    expect(tx.status).toBe(TxStatus.SUCCESS);

    // First find the bet to get the amount
    const [found, betAmount] = await vault.methods
      .find_bet_for_claim(alice.getAddress(), commitment, marketId)
      .simulate({ from: alice.getAddress() });

    expect(found).toBe(true);

    // Try to authorize claim with WRONG secret
    const wrongSecret = Fr.random();
    const recipient = bob.getAddress();
    const claimAuthwitNonce = Fr.random();

    // This should fail because the secret doesn't match the commitment
    await expect(async () => {
      await vault
        .withWallet(alice)
        .methods.authorizeClaim(
          marketId,
          commitment,
          wrongSecret,
          recipient,
          betAmount,  // Include bet amount parameter
          claimAuthwitNonce,
        )
        .send({ from: alice.getAddress() })
        .wait();
    }).rejects.toThrow();

    console.log('Correctly rejected invalid secret!');
  }, 300_000);
});
