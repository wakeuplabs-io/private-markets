
import { TxStatus } from '@aztec/aztec.js/tx';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { type TestWallet } from '@aztec/test-wallet/server';
import { type AztecLMDBStoreV2 } from '@aztec/kv-store/lmdb-v2';
import {
  AMOUNT,
  deployTokenWithMinter,
  expectTokenBalances,
  placeBet,
  setupTestSuite,
  generateBetParams,
  generateCommitment,
  computeNullifier,
  toBigInt,
  runTestStep,
  formatTestError,
} from './utils.js';
import { Contract } from '@aztec/aztec.js/contracts';
import { TokenContract } from '../artifacts/Token.js';
import { BetVaultContract } from '../artifacts/BetVault.js';
import { BetVaultContract as BetVaultContractArtifact } from '../artifacts/BetVault.js';

describe('BetVault - E2E Tests', () => {
  let store: AztecLMDBStoreV2;
  let wallet: TestWallet;
  let accounts: AztecAddress[];

  let alice: AztecAddress;
  let bob: AztecAddress;

  let vault: BetVaultContract;
  let token: TokenContract;
  let wormholeAddress: AztecAddress;
  let admin: AztecAddress;

  beforeAll(async () => {
    ({ store, wallet, accounts } = await setupTestSuite());
    [alice, bob] = accounts;
    admin = bob;
    wormholeAddress = await AztecAddress.random();

    // Deploy token with alice as minter
    token = (await deployTokenWithMinter(wallet, alice, { from: alice })) as TokenContract;
  });

  beforeEach(async () => {
    vault = (await Contract.deploy(
      wallet,
      BetVaultContractArtifact.artifact,
      [token.address, wormholeAddress, admin],
    )
      .send({ from: alice })
      .deployed()) as BetVaultContract;
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
      .simulate({ from: alice });
    expect(storedTokenAddress).toEqual(token.address);

    // Verify admin address is correctly set
    const storedAdminAddress = await vault.methods
      .get_admin()
      .simulate({ from: alice });
    expect(storedAdminAddress).toEqual(admin);

    const mintTx = await token
      .withWallet(wallet)
      .methods.mint_to_public(alice, AMOUNT)
      .send({ from: alice })
      .wait();

    expect(mintTx.status).toBe(TxStatus.SUCCESS);

    const balance = await token.methods
      .balance_of_public(alice)
      .simulate({ from: alice });

    expect(balance).toBe(AMOUNT);
  }, 300_000);

  it('places a bet and marks it as processed', async () => {
    const publicBalanceBefore = await token.methods
    .balance_of_public(alice)
    .simulate({ from: alice });

    const privateBalanceBefore = await token.methods
    .balance_of_private(alice)
    .simulate({ from: alice });

    console.log('publicBalanceBefore', publicBalanceBefore);
    console.log('privateBalanceBefore', privateBalanceBefore);

    await runTestStep('Minting tokens to Alice', async () => {
      await token
        .withWallet(wallet)
        .methods.mint_to_private(alice, AMOUNT)
        .send({ from: alice })
        .wait();
    });

    await runTestStep('Verifying token balance after mint', async () => {
      await expectTokenBalances(token, alice, publicBalanceBefore, privateBalanceBefore + AMOUNT);
    });

    const betParams = await runTestStep('Generating bet parameters', async () => {
      return await generateBetParams();
    });

    if (!betParams) {
      throw new Error('Failed to generate bet parameters');
    }

    await runTestStep('Checking bet status before', async () => {
      const result = await vault.methods
        .is_processed(betParams.betId)
        .simulate({ from: alice });
      expect(result).toBe(false);
      return result;
    });

    const betResult = await runTestStep('Placing bet', async () => {
      return await placeBet(
        vault,
        token,
        alice,
        admin,
        AMOUNT,
        wallet,
        betParams
      );
    });

    if (!betResult) {
      throw new Error('Failed to place bet');
    }

    const { tx, secret, commitment } = betResult;
    expect(tx.status).toBe(TxStatus.SUCCESS);

    await runTestStep('Verifying commitment', async () => {
      const expectedCommitment = await generateCommitment(betParams.marketId, AMOUNT, secret);
      expect(commitment.toString()).toBe(expectedCommitment.toString());
    });

    await runTestStep('Syncing token state', async () => {
      await token.methods.sync_private_state().simulate({ from: alice });
      await token.methods.sync_private_state().simulate({ from: admin });
    });

    await runTestStep('Checking bet status after', async () => {
      const isProcessedAfter = await vault.methods
        .is_processed(betParams.betId)
        .simulate({ from: alice });
      expect(isProcessedAfter).toBe(true);
    });

    await runTestStep('Verifying final balances', async () => {
      await expectTokenBalances(token, alice, publicBalanceBefore, privateBalanceBefore);
      await expectTokenBalances(token, admin, 0, AMOUNT);
    });
  }, 300_000);

  it('should retrieve user bets with get_user_bets', async () => {
    await token
      .withWallet(wallet)
      .methods.mint_to_private(alice, AMOUNT)
      .send({ from: alice })
      .wait();


    // Generate realistic bet parameters
    const { tx, marketId, outcome, commitment, betId, secret } = await placeBet(
      vault,
      token,
      alice,
      admin,
      AMOUNT,
      wallet,
    );

    expect(tx.status).toBe(TxStatus.SUCCESS);

    // Verify commitment is correctly computed from secret and amount
    const expectedCommitment = await generateCommitment(marketId, AMOUNT, secret);
    expect(commitment.toString()).toBe(expectedCommitment.toString());

    const aliceBets = await vault.methods.get_user_bets(alice, 0, 10).simulate({ from: alice });

    expect(aliceBets.len).toBe(1n);
    expect(aliceBets.storage[0].owner).toEqual(alice);
    expect(aliceBets.storage[0].market_id).toEqual(toBigInt(marketId));
    expect(aliceBets.storage[0].outcome).toBe(outcome);
    expect(aliceBets.storage[0].amount).toBe(AMOUNT);
    expect(aliceBets.storage[0].bet_id).toEqual(toBigInt(betId));
    expect(aliceBets.storage[0].commitment).toEqual(toBigInt(commitment));

    // Utility function allows to retrieve bets by other accounts
    const aliceBetsByBob = await vault.methods.get_user_bets(alice, 0, 10).simulate({ from: bob });
    expect(aliceBetsByBob.len).toBe(1n);

  }, 300_000);

  it('should retrieve user bets with pagination', async () => {
    await token
      .withWallet(wallet)
      .methods.mint_to_private(alice, AMOUNT * 11n)
      .send({ from: alice })
      .wait();

    for (let i = 0; i < 11; i++) {
      const { tx } = await placeBet(vault, token, alice, admin, AMOUNT, wallet);
      expect(tx.status).toBe(TxStatus.SUCCESS);
    }

    const firstPage = await vault.methods.get_user_bets(alice, 0, 10).simulate({ from: alice });
    expect(firstPage.len).toBe(10n);

    const secondPage = await vault.methods.get_user_bets(alice, 10, 10).simulate({ from: alice });
    expect(secondPage.len).toBe(1n);
  }, 300_000);

  it('should authorize claim with valid secret and commitment', async () => {
    // Mint tokens to alice
    await token
      .withWallet(wallet)
      .methods.mint_to_private(alice, AMOUNT)
      .send({ from: alice })
      .wait();


    // Place a bet with realistic parameters
    const { tx, marketId, commitment, secret } = await placeBet(
      vault,
      token,
      alice,
      admin,
      AMOUNT,
      wallet,
    );

    expect(tx.status).toBe(TxStatus.SUCCESS);

    // Verify commitment was correctly generated from secret and amount
    const expectedCommitment = await generateCommitment(marketId, AMOUNT, secret);
    expect(commitment.toString()).toBe(expectedCommitment.toString());

    // Define recipient for claim (bob's address)
    const recipient = bob;
    const recipientField = new Fr(recipient.toBigInt());

    // Calculate expected nullifier
    const expectedNullifier = await computeNullifier(marketId, commitment, recipientField);

    // Check nullifier is not used before claim
    const nullifierUsedBefore = await vault.methods
      .is_nullifier_used(expectedNullifier)
      .simulate({ from: alice });
    expect(nullifierUsedBefore).toBe(false);

    const commitmentClaimedBefore = await vault.methods
      .is_commitment_claimed(commitment)
      .simulate({ from: alice });
    expect(commitmentClaimedBefore).toBe(false);
    console.log('✅ Commitment is not claimed before authorization');

    // Step 1: Call find_bet_for_claim to get bet amount (unconstrained pre-flight check)
    const [found, betAmount] = await vault.methods
      .find_bet_for_claim(alice, commitment, marketId)
      .simulate({ from: alice });

    expect(found).toBe(true);
    expect(betAmount).toBe(toBigInt(AMOUNT));

    console.log('Found bet via find_bet_for_claim:', { found, betAmount: betAmount.toString() });

    // Step 2: Authorize claim with the stored secret and bet amount
    const claimAuthwitNonce = Fr.random();

    const authorizeTx = await vault
      .withWallet(wallet)
      .methods.authorizeClaim(
        marketId,
        commitment,
        secret,
        recipient,
        betAmount,
        claimAuthwitNonce,
      )
      .send({ from: alice })
      .wait();

    expect(authorizeTx.status).toBe(TxStatus.SUCCESS);

    // Check nullifier is now marked as used
    const nullifierUsedAfter = await vault.methods
      .is_nullifier_used(expectedNullifier)
      .simulate({ from: alice });
    expect(nullifierUsedAfter).toBe(true);

    // Check commitment is NOW claimed after authorization
    const commitmentClaimedAfter = await vault.methods
      .is_commitment_claimed(commitment)
      .simulate({ from: alice });
    expect(commitmentClaimedAfter).toBe(true);
    console.log('Commitment is now marked as claimed after authorization');

    // Verify double-claim prevention
    console.log('Testing double-claim prevention...');
    await expect(async () => {
      await vault
        .withWallet(wallet)
        .methods.authorizeClaim(
          marketId,
          commitment,
          secret,
          recipient,
          betAmount,
          Fr.random(),
        )
        .send({ from: alice })
        .wait();
    }).rejects.toThrow();
    console.log('Double-claim correctly prevented: "Commitment already claimed"');

    console.log('Claim authorized successfully!');
    console.log('Nullifier:', expectedNullifier.toString());
    console.log('Market ID:', marketId.toString());
    console.log('Recipient:', recipient.toString());
    console.log('All claim tracking verified via claimed_commitments storage');
  }, 300_000);

  it('should fail to authorize claim with invalid secret', async () => {
    // Mint tokens to alice
    await token
      .withWallet(wallet)
      .methods.mint_to_private(alice, AMOUNT)
      .send({ from: alice })
      .wait();

    // Place a bet
    const { tx, marketId, commitment } = await placeBet(
      vault,
      token,
      alice,
      admin,
      AMOUNT,
      wallet,
    );

    expect(tx.status).toBe(TxStatus.SUCCESS);

    // First find the bet to get the amount
    const [found, betAmount] = await vault.methods
      .find_bet_for_claim(alice, commitment, marketId)
      .simulate({ from: alice });

    expect(found).toBe(true);

    // Try to authorize claim with WRONG secret
    const wrongSecret = Fr.random();
    const recipient = bob;
    const claimAuthwitNonce = Fr.random();

    // This should fail because the secret doesn't match the commitment
    await expect(async () => {
      await vault
        .withWallet(wallet)
        .methods.authorizeClaim(
          marketId,
          commitment,
          wrongSecret,
          recipient,
          betAmount,  // Include bet amount parameter
          claimAuthwitNonce,
        )
        .send({ from: alice })
        .wait();
    }).rejects.toThrow();

    console.log('Correctly rejected invalid secret!');
  }, 300_000);
});
