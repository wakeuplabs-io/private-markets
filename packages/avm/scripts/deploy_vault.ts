import { AztecAddress } from "@aztec/aztec.js";
import { TokenContract } from "../artifacts/Token.js";
import { BetVaultContract } from "../artifacts/BetVault.js";
import { aztecSetup } from "./lib/aztec-setup.js";

async function main(): Promise<void> {
  await aztecSetup.setupPXE();
  const deployer = await aztecSetup.getOrCreateWallet("deployer");
  console.log("Deployer address:", deployer.getAddress().toString());

  // Get token address from argument or contracts.json
  const providedTokenAddress = process.argv[2];
  let tokenAddress: string;

  if (providedTokenAddress) {
    console.log(">> Using token address from argument:", providedTokenAddress);
    tokenAddress = providedTokenAddress;
  } else {
    const existingTokenAddress = aztecSetup.loadContractAddress("token");
    if (!existingTokenAddress) {
      console.error("  No token address found. Please:");
      console.error("   1. Run 'npm run deploy:token' first, OR");
      console.error("   2. Provide token address as argument: npm run deploy:vault <TOKEN_ADDRESS>");
      process.exit(1);
    }
    console.log(">> Using token address from contracts.json:", existingTokenAddress);
    tokenAddress = existingTokenAddress;
  }

  // Deploy vault with token address
  console.log("\n>> Deploying BetVault contract...");
  const vaultDeployTxOptions = await aztecSetup.getTxOptions(deployer.getAddress());

  const contract = await BetVaultContract.deploy(
    deployer,
    AztecAddress.fromString(tokenAddress),
    deployer.getAddress(), // admin address
    await AztecAddress.random() // wormhole address
  ).send(vaultDeployTxOptions).deployed();

  console.log("✅ [OK] Vault deployed at:", contract.address.toString());

  // Save vault address
  aztecSetup.saveContractAddress("vault", contract.address.toString());

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("  Token: ", tokenAddress);
  console.log("  Vault: ", contract.address.toString());
  console.log("  Saved to: deploys/contracts.json");
}

main().catch((err) => {
  console.error("Error deploying vault:", err);
  process.exit(1);
});
