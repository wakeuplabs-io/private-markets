import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Fr } from "@aztec/foundation/fields";
import type { IntentAction } from "@aztec/aztec.js/authorization";
import { TokenContract } from "../../artifacts/Token.js";
import { BetVaultContract } from "../../artifacts/BetVault.js";
import { aztecSetup } from "../lib/aztec-setup.js";
import { WormholeContract } from "../../artifacts/Wormhole.js";

const WORMHOLE_ADDRESS = "0x0e61ae3f9f51ae20042f48674e2bf1c19cde5c916ae3a5ed114d84c873cc9a8f";

async function main(): Promise<void> {
  console.log("🎲 Starting Place Bet Script...\n");

  // Initialize Aztec setup (Node → PXE → Wallet)
  await aztecSetup.initialize();
  const network = aztecSetup.getNetwork();
  console.log(`Network: ${network.toUpperCase()}\n`);

  // Get or create accounts
  const deployerAddress = await aztecSetup.getOrCreateAccount("deployer");
  const executorAddress = await aztecSetup.getOrCreateAccount("executor");

  // Get wallet instance
  const wallet = aztecSetup.getWallet();

  console.log("✅ Deployer address:", deployerAddress.toString());
  console.log("✅ Executor address:", executorAddress.toString());

  const tokenAddress = aztecSetup.loadContractAddress("token");
  if (!tokenAddress) {
    console.error("No token address found. Run 'npm run deploy:token' first.");
    process.exit(1);
  }
  console.log("Token address:", tokenAddress);

  const vaultAddress = aztecSetup.loadContractAddress("vault");
  if (!vaultAddress) {
    console.error("No vault address found. Run 'npm run deploy:vault' first.");
    process.exit(1);
  }
  console.log("Vault address:", vaultAddress);

  console.log("\n📝 Registering contracts with wallet...");
  const tokenAddr = AztecAddress.fromString(tokenAddress);
  const vaultAddr = AztecAddress.fromString(vaultAddress);

  await aztecSetup.registerContract(tokenAddr, TokenContract.artifact);
  await aztecSetup.registerContract(vaultAddr, BetVaultContract.artifact);
  await aztecSetup.registerContract(AztecAddress.fromString(WORMHOLE_ADDRESS), WormholeContract.artifact);

  const token = await TokenContract.at(tokenAddr, wallet);
  const vault = await BetVaultContract.at(vaultAddr, wallet);

  const marketId = Fr.random();
  const outcome = 1n; // 1 = YES, 0 = NO
  const amount = 10n * 10n ** 18n; // 10 tokens
  const commitment = Fr.random();
  const betId = Fr.random();
  const authwitNonce = Fr.random();

  console.log("\nBet Parameters:");
  console.log("  Market ID:  ", marketId.toString());
  console.log("  Outcome:    ", outcome === 1n ? "YES" : "NO");
  console.log("  Amount:     ", amount.toString());
  console.log("  Commitment: ", commitment.toString());
  console.log("  Bet ID:     ", betId.toString());

  console.log("\n🔍 Checking if bet is already processed...");
  const isProcessedBefore = await vault.methods
    .is_processed(betId)
    .simulate({ from: executorAddress });

  console.log("  Processed before:", isProcessedBefore);

  if (isProcessedBefore) {
    console.error("❌ Bet ID already processed. Use a different betId or generate a random one.");
    process.exit(1);
  }

  console.log("\n💰 Checking token balance before bet...");
  const balanceBefore = await token.methods
    .balance_of_private(executorAddress)
    .simulate({ from: executorAddress });
  console.log("  Balance before: ", balanceBefore.toString());

  if (balanceBefore < amount) {
    console.error("❌ Insufficient balance. Need:", amount.toString(), "Have:", balanceBefore.toString());
    console.error("   Run 'npm run mint:tokens' first to mint tokens.");
    process.exit(1);
  }

  console.log("\n🔐 Creating authorization witness for token transfer...");
  const transferAction = token.methods.transfer_private_to_private(
    executorAddress,
    deployerAddress,
    amount,
    authwitNonce,
  );

  const intent: IntentAction = {
    caller: vault.address,
    action: transferAction,
  };

  const witness = await wallet.createAuthWit(intent);
  console.log("✅ Authorization witness created");

  console.log("\n🎲 Placing bet...");
  const txOptions = await aztecSetup.getTxOptions(executorAddress);

  const betTx = await vault.methods
    .bet(
      marketId,
      outcome,
      amount,
      commitment,
      betId,
      authwitNonce,
      executorAddress,
    )
    .with({ authWitnesses: [witness] })
    .send(txOptions);

  console.log("   Bet transaction sent, waiting for confirmation...");
  console.log("   (This may take several minutes on testnet)");

  // Wait for transaction
  const receipt = await betTx.wait({ timeout: 60 * 60 * 12 });

  console.log("✅ Bet placed successfully!");
  console.log("   Transaction hash:", receipt.txHash.toString());

  // Check if bet is now processed
  console.log("\n🔍 Checking if bet is now processed...");
  const isProcessedAfter = await vault.methods
    .is_processed(betId)
    .simulate({ from: executorAddress });

  console.log("  Processed after: ", isProcessedAfter);

  if (!isProcessedAfter) {
    console.warn("⚠️  Warning: Bet was not marked as processed!");
  }

  console.log("\n🔄 Syncing private state...");
  await token.methods.sync_private_state().simulate({ from: executorAddress });

  console.log("\n💰 Checking token balance after bet...");
  const balanceAfter = await token.methods
    .balance_of_private(executorAddress)
    .simulate({ from: executorAddress });
  console.log("  Balance after:  ", balanceAfter.toString());

  const spent = balanceBefore - balanceAfter;
  console.log("  Amount spent:   ", spent.toString());

  console.log("\n=== BET SUMMARY ===");
  console.log("  Network:          ", network);
  console.log("  Token:            ", tokenAddress);
  console.log("  Vault:            ", vaultAddress);
  console.log("  Bettor:           ", executorAddress.toString());
  console.log("  Market ID:        ", marketId.toString());
  console.log("  Outcome:          ", outcome === 1n ? "YES" : "NO");
  console.log("  Amount:           ", amount.toString());
  console.log("  Bet ID:           ", betId.toString());
  console.log("  Processed Before: ", isProcessedBefore);
  console.log("  Processed After:  ", isProcessedAfter);
  console.log("  Balance Before:   ", balanceBefore.toString());
  console.log("  Balance After:    ", balanceAfter.toString());
  console.log("  Amount Spent:     ", spent.toString());
  console.log("===================");
}

main().catch((err) => {
  console.error("❌ Error placing bet:", err);
  process.exit(1);
});
