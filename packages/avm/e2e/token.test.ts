import {
  ContractDeployer,
  Fr,
  TxStatus,
  Contract,
  AccountWalletWithSecretKey,
  IntentAction,
  Wallet,
  getContractInstanceFromInstantiationParams,
} from '@aztec/aztec.js';
import { AMOUNT, deployTokenWithMinter, expectTokenBalances, expectUintNote, setupPXE, wad } from './utils.js';
import { PXE } from '@aztec/stdlib/interfaces/client';
import { AztecLmdbStore } from '@aztec/kv-store/lmdb';
import { getInitialTestAccountsManagers } from '@aztec/accounts/testing';
import { TokenContractArtifact, TokenContract } from '../artifacts/Token.js';

export async function deployTokenWithInitialSupply(deployer: Wallet, options: any) {
  const contract = await Contract.deploy(
    deployer,
    TokenContractArtifact,
    ['PrivateToken', 'PT', 18, 0, deployer.getAddress(), deployer.getAddress()],
    'constructor_with_initial_supply',
  )
    .send({ ...options, from: deployer.getAddress() })
    .deployed();
  return contract;
}

const setupTestSuite = async () => {
  const { pxe, store } = await setupPXE();
  const managers = await getInitialTestAccountsManagers(pxe);
  const wallets = await Promise.all(managers.map((acc) => acc.register()));
  const [deployer] = wallets;

  return { pxe, store, deployer, wallets };
};

describe.skip('Token - Single PXE', () => {
  let pxe: PXE;
  let store: AztecLmdbStore;

  let wallets: AccountWalletWithSecretKey[];
  let deployer: AccountWalletWithSecretKey;

  let alice: AccountWalletWithSecretKey;
  let bob: AccountWalletWithSecretKey;
  let carl: AccountWalletWithSecretKey;

  let token: TokenContract;

  beforeAll(async () => {
    ({ pxe, store, deployer, wallets } = await setupTestSuite());

    [alice, bob, carl] = wallets;
  });

  beforeEach(async () => {
    token = (await deployTokenWithMinter(alice, { from: alice.getAddress() })) as TokenContract;
  });

  afterAll(async () => {
    await store.delete();
  });

  it('deploys the contract with minter', async () => {
    const salt = Fr.random();
    const deployerWallet = alice;

    const deploymentData = await getContractInstanceFromInstantiationParams(TokenContractArtifact, {
      constructorArtifact: 'constructor_with_minter',
      constructorArgs: ['PrivateToken', 'PT', 18, deployerWallet.getAddress(), deployerWallet.getAddress()],
      salt,
      deployer: deployerWallet.getAddress(),
    });

    const deployer = new ContractDeployer(TokenContractArtifact, deployerWallet, undefined, 'constructor_with_minter');
    const tx = deployer
      .deploy('PrivateToken', 'PT', 18, deployerWallet.getAddress(), deployerWallet.getAddress())
      .send({
        contractAddressSalt: salt,
        from: deployerWallet.getAddress(),
      });
    const receipt = await tx.getReceipt();

    expect(receipt).toEqual(
      expect.objectContaining({
        status: TxStatus.PENDING,
        error: '',
      }),
    );

    const receiptAfterMined = await tx.wait({ wallet: deployerWallet });

    const contractMetadata = await pxe.getContractMetadata(deploymentData.address);
    expect(contractMetadata).toBeDefined();
    // TODO: Fix this
    // expect(contractMetadata.isContractPubliclyDeployed).toBeTruthy();
    expect(receiptAfterMined).toEqual(
      expect.objectContaining({
        status: TxStatus.SUCCESS,
      }),
    );

    expect(receiptAfterMined.contract.instance.address).toEqual(deploymentData.address);
  }, 300_000);

  it('deploys the contract with initial supply', async () => {
    const salt = Fr.random();
    const deployerWallet = alice; // using first account as deployer

    const deploymentData = await getContractInstanceFromInstantiationParams(TokenContractArtifact, {
      constructorArtifact: 'constructor_with_initial_supply',
      constructorArgs: ['PrivateToken', 'PT', 18, 1, deployerWallet.getAddress(), deployerWallet.getAddress()],
      salt,
      deployer: deployerWallet.getAddress(),
    });
    const deployer = new ContractDeployer(
      TokenContractArtifact,
      deployerWallet,
      undefined,
      'constructor_with_initial_supply',
    );
    const tx = deployer
      .deploy('PrivateToken', 'PT', 18, 1, deployerWallet.getAddress(), deployerWallet.getAddress())
      .send({ contractAddressSalt: salt, from: deployerWallet.getAddress() });
    const receipt = await tx.getReceipt();

    expect(receipt).toEqual(
      expect.objectContaining({
        status: TxStatus.PENDING,
        error: '',
      }),
    );

    const receiptAfterMined = await tx.wait({ wallet: deployerWallet });

    const contractMetadata = await pxe.getContractMetadata(deploymentData.address);
    expect(contractMetadata).toBeDefined();
    // TODO: Fix this
    // expect(contractMetadata.isContractPubliclyDeployed).toBeTruthy();
    expect(receiptAfterMined).toEqual(
      expect.objectContaining({
        status: TxStatus.SUCCESS,
      }),
    );

    expect(receiptAfterMined.contract.instance.address).toEqual(deploymentData.address);
  }, 300_000);

  it('mints', async () => {
    await token.withWallet(alice);
    const tx = await token.methods.mint_to_public(bob.getAddress(), AMOUNT).send({ from: alice.getAddress() }).wait();
    const balance = await token.methods.balance_of_public(bob.getAddress()).simulate({ from: alice.getAddress() });
    expect(balance).toBe(AMOUNT);
  }, 300_000);

  it('transfers tokens between public accounts', async () => {
    // First mint 2 tokens to alice
    await token
      .withWallet(alice)
      .methods.mint_to_public(alice.getAddress(), AMOUNT * 2n)
      .send({ from: alice.getAddress() })
      .wait();

    // Transfer 1 token from alice to bob
    await token
      .withWallet(alice)
      .methods.transfer_public_to_public(alice.getAddress(), bob.getAddress(), AMOUNT, 0)
      .send({ from: alice.getAddress() })
      .wait();

    // Check balances are correct
    const aliceBalance = await token.methods
      .balance_of_public(alice.getAddress())
      .simulate({ from: alice.getAddress() });
    const bobBalance = await token.methods.balance_of_public(bob.getAddress()).simulate({ from: alice.getAddress() });

    expect(aliceBalance).toBe(AMOUNT);
    expect(bobBalance).toBe(AMOUNT);
  }, 300_000);


  it('transfers tokens from private to public balance', async () => {
    // First mint to private 2 tokens to alice
    await token
      .withWallet(alice)
      .methods.mint_to_private(alice.getAddress(), alice.getAddress(), AMOUNT * 2n)
      .send({ from: alice.getAddress() })
      .wait();

    // Transfer 1 token from alice's private balance to public balance
    await token
      .withWallet(alice)
      .methods.transfer_private_to_public(alice.getAddress(), alice.getAddress(), AMOUNT, 0)
      .send({ from: alice.getAddress() })
      .wait();

    // Check public balance is correct
    const alicePublicBalance = await token.methods
      .balance_of_public(alice.getAddress())
      .simulate({ from: alice.getAddress() });
    expect(alicePublicBalance).toBe(AMOUNT);

    // Check total supply hasn't changed
    const totalSupply = await token.methods.total_supply().simulate({ from: alice.getAddress() });
    expect(totalSupply).toBe(AMOUNT * 2n);
  }, 300_000);



  it('can transfer tokens between private balances', async () => {
    // Mint 2 tokens privately to alice
    await token
      .withWallet(alice)
      .methods.mint_to_private(alice.getAddress(), alice.getAddress(), AMOUNT * 2n)
      .send({ from: alice.getAddress() })
      .wait();

    // Transfer 1 token from alice to bob's private balance
    await token
      .withWallet(alice)
      .methods.transfer_private_to_private(alice.getAddress(), bob.getAddress(), AMOUNT, 0)
      .send({ from: alice.getAddress() })
      .wait();

    // Try to transfer more than available balance
    // TODO(#29): fix "Invalid arguments size: expected 3, got 2" error handling
    // await expect(
    //   token
    //     .withWallet(alice)
    //     .methods.transfer_private_to_private(alice.getAddress(), bob.getAddress(), AMOUNT + 1n, 0)
    //     .send()
    //     .wait(),
    // ).rejects.toThrow(/Balance too low/);

    // Check total supply hasn't changed
    const totalSupply = await token.methods.total_supply().simulate({ from: alice.getAddress() });
    expect(totalSupply).toBe(AMOUNT * 2n);
  }, 300_000);

  it('can mint tokens to private balance', async () => {
    // Mint 2 tokens privately to alice
    await token
      .withWallet(alice)
      .methods.mint_to_private(alice.getAddress(), alice.getAddress(), AMOUNT * 2n)
      .send({ from: alice.getAddress() })
      .wait();

    // Check total supply increased
    const totalSupply = await token.methods.total_supply().simulate({ from: alice.getAddress() });
    expect(totalSupply).toBe(AMOUNT * 2n);

    // Public balance should be 0 since we minted privately
    const alicePublicBalance = await token.methods
      .balance_of_public(alice.getAddress())
      .simulate({ from: alice.getAddress() });
    expect(alicePublicBalance).toBe(0n);
  }, 300_000);

  it('can burn tokens from private balance', async () => {
    // Mint 2 tokens privately to alice
    await token
      .withWallet(alice)
      .methods.mint_to_private(alice.getAddress(), alice.getAddress(), AMOUNT * 2n)
      .send({ from: alice.getAddress() })
      .wait();

    // Burn 1 token from alice's private balance
    await token
      .withWallet(alice)
      .methods.burn_private(alice.getAddress(), AMOUNT, 0)
      .send({ from: alice.getAddress() })
      .wait();

    // Try to burn more than available balance
    await expect(
      token
        .withWallet(alice)
        .methods.burn_private(alice.getAddress(), AMOUNT * 2n, 0)
        .send({ from: alice.getAddress() })
        .wait(),
    ).rejects.toThrow(/Balance too low/);

    // Check total supply decreased
    const totalSupply = await token.methods.total_supply().simulate({ from: alice.getAddress() });
    expect(totalSupply).toBe(AMOUNT);

    // Public balance should still be 0
    const alicePublicBalance = await token.methods
      .balance_of_public(alice.getAddress())
      .simulate({ from: alice.getAddress() });
    expect(alicePublicBalance).toBe(0n);
  }, 300_000);

  it('can transfer tokens from public to private balance', async () => {
    // Mint 2 tokens publicly to alice
    await token
      .withWallet(alice)
      .methods.mint_to_public(alice.getAddress(), AMOUNT * 2n)
      .send({ from: alice.getAddress() })
      .wait();

    // Transfer 1 token from alice's public balance to private balance
    await token
      .withWallet(alice)
      .methods.transfer_public_to_private(alice.getAddress(), alice.getAddress(), AMOUNT, 0)
      .send({ from: alice.getAddress() })
      .wait();

    // Try to transfer more than available public balance
    // TODO(#29): fix "Invalid arguments size: expected 3, got 2" error handling
    // await expect(
    //   token
    //     .withWallet(alice)
    //     .methods.transfer_public_to_private(alice.getAddress(), alice.getAddress(), AMOUNT * 2n, 0)
    //     .send()
    //     .wait(),
    // ).rejects.toThrow(/attempt to subtract with underflow/);

    // Check total supply stayed the same
    const totalSupply = await token.methods.total_supply().simulate({ from: alice.getAddress() });
    expect(totalSupply).toBe(AMOUNT * 2n);

    // Public balance should be reduced by transferred amount
    const alicePublicBalance = await token.methods
      .balance_of_public(alice.getAddress())
      .simulate({ from: alice.getAddress() });
    expect(alicePublicBalance).toBe(AMOUNT);
  }, 300_000);

  it('private transfer with authwitness', async () => {
    // setup balances
    await token
      .withWallet(alice)
      .methods.mint_to_public(alice.getAddress(), AMOUNT)
      .send({ from: alice.getAddress() })
      .wait();
    await token
      .withWallet(alice)
      .methods.transfer_public_to_private(alice.getAddress(), alice.getAddress(), AMOUNT, 0)
      .send({ from: alice.getAddress() })
      .wait();

    expect(await token.methods.balance_of_private(alice.getAddress()).simulate({ from: alice.getAddress() })).toBe(
      AMOUNT,
    );

    // prepare action
    const nonce = Fr.random();
    const action = token
      .withWallet(carl)
      .methods.transfer_private_to_private(alice.getAddress(), bob.getAddress(), AMOUNT, nonce);

    const intent: IntentAction = {
      caller: carl.getAddress(),
      action,
    };
    const witness = await alice.createAuthWit(intent);

    const validity = await alice.lookupValidity(alice.getAddress(), intent, witness);
    expect(validity.isValidInPrivate).toBeTruthy();
    expect(validity.isValidInPublic).toBeFalsy();

    await action.send({ from: carl.getAddress(), authWitnesses: [witness] }).wait();

    expect(await token.methods.balance_of_private(alice.getAddress()).simulate({ from: alice.getAddress() })).toBe(0n);
    expect(await token.methods.balance_of_private(bob.getAddress()).simulate({ from: alice.getAddress() })).toBe(
      AMOUNT,
    );
  }, 300_000);
});