import { AztecAddress } from "@aztec/aztec.js";
import { TokenContract } from "../artifacts/Token.js";
import { aztecSetup } from "./lib/aztec-setup.js";

async function main(): Promise<void> {
  console.log("🪙 Starting Token Mint Script...\n");

  await aztecSetup.setupPXE();
  const network = aztecSetup.getNetwork();
  console.log(`Network: ${network.toUpperCase()}\n`);

  const deployer = await aztecSetup.getOrCreateWallet("deployer");
  const deployerAddress = deployer.getAddress();
  console.log("✅ Deployer address:", deployerAddress.toString());

  const tokenAddress = aztecSetup.loadContractAddress("token");
  if (!tokenAddress) {
    console.error("❌ No token address found. Run 'npm run deploy:token' first.");
    process.exit(1);
  }

  console.log("✅ Token address:", tokenAddress);

  console.log("\n📝 Registering Token contract with PXE...");
  const tokenAddr = AztecAddress.fromString(tokenAddress);
  await aztecSetup.registerContract(tokenAddr, TokenContract.artifact);

  const token = await TokenContract.at(tokenAddr, deployer);

  console.log("\n📊 Checking initial balance...");

  const initialBalance = await token.methods
    .balance_of_private(deployerAddress)
    .simulate({ from: deployerAddress });

  console.log(`   Initial balance: ${initialBalance.toString()} tokens\n`);

  const amountToMint = 1000n * 10n ** 18n;
  console.log(`🪙 Minting ${amountToMint.toString()} tokens to deployer...`);

  const txOptions = await aztecSetup.getTxOptions(deployerAddress);

  const mintTx = await token.methods
    .mint_to_private(deployerAddress, deployerAddress, amountToMint)
    .send(txOptions);

  console.log("   Mint transaction sent, waiting for confirmation...");
  console.log("   (This may take several minutes on testnet)");

  await mintTx.wait({ timeout: 60 * 60 * 12 });

  console.log("✅ Tokens minted successfully!\n");

  console.log("📊 Checking final balance...");

  const finalBalance = await token.methods
    .balance_of_private(deployerAddress)
    .simulate({ from: deployerAddress });

  console.log(`   Final balance: ${finalBalance.toString()} tokens`);

  const difference = finalBalance - initialBalance;
  console.log(`   Minted: ${difference.toString()} tokens\n`);

  console.log("=== MINT SUMMARY ===");
  console.log("  Network:        ", network);
  console.log("  Token:          ", tokenAddress);
  console.log("  Recipient:      ", deployerAddress.toString());
  console.log("  Amount Minted:  ", amountToMint.toString());
  console.log("  Initial Balance:", initialBalance.toString());
  console.log("  Final Balance:  ", finalBalance.toString());
  console.log("====================");
}

main().catch((err) => {
  console.error("❌ Error minting tokens:", err);
  process.exit(1);
});
