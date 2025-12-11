import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { aztecSetup } from "../lib/aztec-setup.js";
import { ContractDeployer } from "@aztec/aztec.js/deployment";
import { TokenContractArtifact } from "../../artifacts/Token.js";
import { Fr } from "@aztec/aztec.js/fields";

async function main(): Promise<void> {
  console.log("🚀 Starting Token deployment...\n");
  const network = aztecSetup.getNetwork();

  await aztecSetup.initialize();

  const deployerAddress = await aztecSetup.getOrCreateAccount("deployer");
  console.log("Deployer address:", deployerAddress.toString());

  const wallet = aztecSetup.getWallet();

  const minterAddressArg = process.env.MINTER_ADDRESS || process.argv[2];
  const minterAddress = minterAddressArg
    ? AztecAddress.fromString(minterAddressArg)
    : deployerAddress;

  console.log("Minter address:", minterAddress.toString());

  console.log("\n>> Deploying Token contract...");
  const salt = Fr.random();

  // Get sponsored payment method for fee payment
  const sponsoredPaymentMethod = await aztecSetup.getSponsoredPaymentMethod();

  const deployer = new ContractDeployer(TokenContractArtifact, wallet, undefined, 'constructor_with_minter');
  const tx = deployer.deploy('PrivateToken', 'PT', 18, minterAddress, minterAddress).send({
    contractAddressSalt: salt,
    from: deployerAddress,
    ...(sponsoredPaymentMethod ? { fee: { paymentMethod: sponsoredPaymentMethod } } : {}),
  });

  // const receipt = await tx.getReceipt();

  console.log("Deployment transaction sent, waiting for confirmation...");
  console.log("   (This may take several minutes on testnet)");
  const receiptAfterMined = await tx.wait({ wallet: wallet });

  const contract = receiptAfterMined.contract;

  console.log("\n[OK] Token deployed successfully!");
  console.log("   Address:", contract.address.toString());

  aztecSetup.saveContractAddress("token", contract.address.toString());

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("  Token Contract: ", contract.address.toString());
  console.log("  Minter Address: ", minterAddress.toString());
  console.log("  Saved to:        ", `deployments/${network}/contracts.json`);
  console.log("==========================\n");
}

main().catch((err) => {
  console.error("\n[ERROR] Error deploying token:");
  console.error(err);
  process.exit(1);
});
