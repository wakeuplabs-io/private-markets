import { AztecAddress } from "@aztec/aztec.js";
import { TokenContract } from "../artifacts/Token.js";
import { BetVaultContract } from "../artifacts/BetVault.js";
import { aztecSetup } from "./lib/aztec-setup.js";

async function main(): Promise<void> {
  // Get Wormhole address from environment variable
  // const WORMHOLE_ADDRESS = process.env.WORMHOLE_ADDRESS;
  const WORMHOLE_ADDRESS = "0x0e61ae3f9f51ae20042f48674e2bf1c19cde5c916ae3a5ed114d84c873cc9a8f";

  await aztecSetup.setupPXE();
  const network = aztecSetup.getNetwork();
  console.log(`Deploying to ${network.toUpperCase()} environment`);

  const deployer = await aztecSetup.getOrCreateWallet("deployer");
  console.log("Deployer address:", deployer.getAddress().toString());

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

  console.log("\n>> Deploying BetVault contract...");
  const vaultDeployTxOptions = await aztecSetup.getTxOptions(deployer.getAddress());

  const deployTx = BetVaultContract.deploy(
    deployer,
    AztecAddress.fromString(tokenAddress),
    AztecAddress.fromString(WORMHOLE_ADDRESS),
    deployer.getAddress(), // admin address
  ).send(vaultDeployTxOptions);

  console.log("   Deployment transaction sent, waiting for confirmation...");
  console.log("   (This may take several minutes on testnet)");

  await deployTx.wait({ timeout: 60 * 60 * 12 });

  const contract = await deployTx.deployed();

  console.log("[OK] Vault deployed at:", contract.address.toString());

  aztecSetup.saveContractAddress("vault", contract.address.toString());

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("  Network:  ", network);
  console.log("  Token:    ", tokenAddress);
  console.log("  Wormhole: ", WORMHOLE_ADDRESS);
  console.log("  Vault:    ", contract.address.toString());
  console.log("  Saved to:  deploys/contracts.json");
}

main().catch((err) => {
  console.error("Error deploying vault:", err);
  process.exit(1);
});
