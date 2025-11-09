import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { BetVaultContractArtifact } from "../../artifacts/BetVault.js";
import { aztecSetup } from "../lib/aztec-setup.js";
import { ContractDeployer } from "@aztec/aztec.js/deployment";
import { Fr } from "@aztec/aztec.js/fields";

async function main(): Promise<void> {
  console.log("🚀 Starting BetVault deployment...\n");

  // Get Wormhole address from environment variable
  // const WORMHOLE_ADDRESS = process.env.WORMHOLE_ADDRESS;
  const WORMHOLE_ADDRESS = "0x2f56338d0bf01e37b89edea0ee8e96474c89575aa5e6f35012789738a06ed0ac";

  // Initialize Aztec setup (Node → PXE → Wallet)
  await aztecSetup.initialize();

  // Get or create deployer account
  const deployerAddress = await aztecSetup.getOrCreateAccount("deployer");
  console.log("Deployer address:", deployerAddress.toString());

  // Get wallet instance
  const wallet = aztecSetup.getWallet();

  // Get network for summary
  const network = aztecSetup.getNetwork();

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
  const salt = Fr.random();

  // Get sponsored payment method for fee payment
  const sponsoredPaymentMethod = await aztecSetup.getSponsoredPaymentMethod();

  const deployer = new ContractDeployer(BetVaultContractArtifact, wallet);
  const tx = deployer.deploy(
    AztecAddress.fromString(tokenAddress),
    AztecAddress.fromString(WORMHOLE_ADDRESS),
    deployerAddress, // admin address
  ).send({
    contractAddressSalt: salt,
    from: deployerAddress,
    ...(sponsoredPaymentMethod ? { fee: { paymentMethod: sponsoredPaymentMethod } } : {}),
  });

  console.log("Deployment transaction sent, waiting for confirmation...");
  console.log("   (This may take several minutes on testnet)");

  const receiptAfterMined = await tx.wait({ wallet: wallet });
  const contract = receiptAfterMined.contract;

  console.log("\n[OK] BetVault deployed successfully!");
  console.log("   Address:", contract.address.toString());

  aztecSetup.saveContractAddress("vault", contract.address.toString());

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("  Network:         ", network);
  console.log("  Token Contract:  ", tokenAddress);
  console.log("  Wormhole Address:", WORMHOLE_ADDRESS);
  console.log("  BetVault Contract:", contract.address.toString());
  console.log("  Saved to:        ", `deployments/${network}/contracts.json`);
  console.log("==========================\n");
}

main().catch((err) => {
  console.error("\n[ERROR] Error deploying BetVault:");
  console.error(err);
  process.exit(1);
});
