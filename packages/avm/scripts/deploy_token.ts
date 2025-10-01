import { AztecAddress } from "@aztec/aztec.js";
import { TokenContract } from "../artifacts/Token.js";
import { aztecSetup } from "./lib/aztec-setup.js";

async function main(): Promise<void> {
  await aztecSetup.setupPXE();
  const deployer = await aztecSetup.getOrCreateWallet("deployer");
  console.log("Deployer address:", deployer.getAddress().toString());

  // Get minter address from command line argument, default to deployer
  const minterAddressArg = process.argv[2];
  const minterAddress = minterAddressArg
    ? AztecAddress.fromString(minterAddressArg)
    : deployer.getAddress();

  console.log("Minter address:", minterAddress.toString());

  console.log("\n>> Deploying Token contract...");
  const deployTxOptions = await aztecSetup.getTxOptions(deployer.getAddress());

  const contract = await TokenContract.deployWithOpts(
    { wallet: deployer, method: 'constructor_with_minter' },
    "Aztec USD",
    "AUSD",
    18,
    minterAddress,
    minterAddress
  ).send(deployTxOptions).deployed();

  console.log("✅ [OK] Token deployed at:", contract.address.toString());

  // Save contract address
  aztecSetup.saveContractAddress("token", contract.address.toString());

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("  Token: ", contract.address.toString());
  console.log("  Minter: ", minterAddress.toString());
  console.log("  Saved to: deploys/contracts.json");
}

main().catch((err) => {
  console.error("Error deploying token:", err);
  process.exit(1);
});
