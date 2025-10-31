import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { TokenContract } from "../../artifacts/Token.js";
import { aztecSetup } from "../lib/aztec-setup.js";

async function main(): Promise<void> {
  console.log("🚀 Starting Token deployment...\n");

  // Initialize Aztec setup (Node → PXE → Wallet)
  await aztecSetup.initialize();

  // Get or create deployer account
  const deployerAddress = await aztecSetup.getOrCreateAccount("deployer");
  console.log("Deployer address:", deployerAddress.toString());

  // Get wallet instance
  const wallet = aztecSetup.getWallet();

  const minterAddressArg = process.env.MINTER_ADDRESS || process.argv[2];
  const minterAddress = minterAddressArg
    ? AztecAddress.fromString(minterAddressArg)
    : deployerAddress;

  console.log("Minter address:", minterAddress.toString());

  console.log("\n>> Deploying Token contract...");
  const deployTxOptions = await aztecSetup.getTxOptions(deployerAddress);

  const deployTx = await TokenContract.deployWithOpts(
    { wallet: wallet, method: 'constructor_with_minter' },
    "Aztec USD",
    "AUSD",
    18,
    minterAddress,
    minterAddress
  ).send(deployTxOptions);

  console.log("Deployment transaction sent, waiting for confirmation...");
  console.log("   (This may take several minutes on testnet)");

  const receipt = await deployTx.wait({ 
    timeout: 60 * 60 * 12,   // 12 hours timeout for testnet
    interval: 1000,          // Check every second
  });

  const contract = receipt.contract;

  console.log("\n[OK] Token deployed successfully!");
  console.log("   Address:", contract.address.toString());

  aztecSetup.saveContractAddress("token", contract.address.toString());

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("  Token Contract: ", contract.address.toString());
  console.log("  Minter Address: ", minterAddress.toString());
  console.log("  Saved to:       deploys/contracts.json");
  console.log("==========================\n");
}

main().catch((err) => {
  console.error("\n[ERROR] Error deploying token:");
  console.error(err);
  process.exit(1);
});
