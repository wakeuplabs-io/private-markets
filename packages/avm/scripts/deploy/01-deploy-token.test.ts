import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { TxStatus } from "@aztec/aztec.js/tx";
import { TokenContract } from "../../artifacts/Token.js";
import { aztecTestSetup } from "../lib/aztec-test-setup.js";

async function main(): Promise<void> {
  console.log("🚀 Starting Token deployment (TEST MODE - Sandbox)...\n");

  // Initialize test environment with pre-loaded sandbox accounts
  const { alice } = await aztecTestSetup.initialize();
  const wallet = aztecTestSetup.getWallet();  // Get the ScriptTestWallet
  const deployerAddress = alice.getAddress();  // Use alice's address

  console.log("Deployer (alice):", deployerAddress.toString());

  const minterAddressArg = process.env.MINTER_ADDRESS || process.argv[2];
  const minterAddress = minterAddressArg
    ? AztecAddress.fromString(minterAddressArg)
    : deployerAddress;

  console.log("Minter address:", minterAddress.toString());

  console.log("\n>> Deploying Token contract...");

  const deployTx = await TokenContract.deployWithOpts(
    { wallet: wallet, method: 'constructor_with_minter' },
    "Aztec USD",
    "AUSD",
    18,
    minterAddress,
    minterAddress
  ).send({ from: deployerAddress });

  // Get contract address immediately (deterministic)
  const instance = await deployTx.instanceGetter();
  const contractAddress = instance.address;

  console.log("Deployment transaction sent!");
  console.log("   Contract address (deterministic):", contractAddress.toString());

  // Get transaction hash for monitoring
  const txHash = await deployTx.getTxHash();
  console.log("   Transaction hash:", txHash.toString());

  // Step 1: Wait for transaction to be mined AND processed successfully
  console.log("\n>> Waiting for transaction to be mined and processed...");
  const maxReceiptRetries = 30; // 30 attempts × 5s = 2.5 minutes max
  const receiptInterval = 5000; // 5 seconds

  let receipt = null;
  for (let attempt = 1; attempt <= maxReceiptRetries; attempt++) {
    try {
      console.log(`   Checking for receipt... (attempt ${attempt}/${maxReceiptRetries})`);
      receipt = await deployTx.getReceipt();

      if (receipt) {
        console.log(`   Receipt found - Status: ${receipt.status}, Block: ${receipt.blockNumber}`);

        // Wait until status is SUCCESS (not PENDING)
        if (receipt.status === TxStatus.SUCCESS) {
          console.log("✅ Transaction successfully processed!");
          console.log(`   Block number: ${receipt.blockNumber}`);
          break;
        } else if (receipt.status === TxStatus.APP_LOGIC_REVERTED ||
                   receipt.status === TxStatus.TEARDOWN_REVERTED ||
                   receipt.status === TxStatus.BOTH_REVERTED) {
          throw new Error(`Transaction reverted with status: ${receipt.status}`);
        } else if (receipt.status === TxStatus.DROPPED) {
          throw new Error("Transaction was dropped!");
        } else {
          console.log(`   Transaction still ${receipt.status}, waiting...`);
          // Keep polling
          receipt = null;
        }
      }
    } catch (error: any) {
      // Receipt not yet available or error occurred
      if (error.message === "Transaction reverted!") {
        throw error;
      }
    }

    if (!receipt && attempt < maxReceiptRetries) {
      await new Promise(resolve => setTimeout(resolve, receiptInterval));
    }
  }

  if (!receipt) {
    throw new Error(`Transaction did not complete successfully after ${maxReceiptRetries} attempts`);
  }

  // Step 2: Verify deployment by calling a view method
  console.log("\n>> Verifying contract is callable...");
  const contract = await TokenContract.at(contractAddress, wallet);

  // Wait a bit for bytecode to propagate
  console.log("   Waiting 5 seconds for bytecode to propagate...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  const maxVerifyRetries = 6; // 6 attempts × 5s = 30 seconds max
  let verified = false;

  for (let attempt = 1; attempt <= maxVerifyRetries; attempt++) {
    try {
      console.log(`   Calling symbol()... (attempt ${attempt}/${maxVerifyRetries})`);
      const symbol = await contract.methods.symbol().simulate({ from: deployerAddress });
      const name = await contract.methods.name().simulate({ from: deployerAddress });

      console.log("\n✅ Token deployed and verified!");
      console.log("   Address:", contract.address.toString());
      console.log("   Symbol:", symbol);
      console.log("   Name:", name);

      verified = true;
      break;
    } catch (error: any) {
      console.log(`   ❌ Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxVerifyRetries) {
        console.log(`   ⏳ Retrying in ${receiptInterval / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, receiptInterval));
      }
    }
  }

  if (!verified) {
    console.log("\n⚠️  Warning: Contract deployed but verification failed");
    console.log("   This is likely due to bytecode propagation delay");
    console.log("   Contract address:", contract.address.toString());
  }

  aztecTestSetup.saveContractAddress("token", contract.address.toString());

  console.log("\n=== DEPLOYMENT SUMMARY (TEST MODE) ===");
  console.log("  Token Contract: ", contract.address.toString());
  console.log("  Minter Address: ", minterAddress.toString());
  console.log("  Deployer:       ", deployerAddress.toString());
  console.log("  Saved to:        deployments/sandbox-test/contracts.json");
  console.log("=======================================\n");
}

main().catch((err) => {
  console.error("\n❌ Error deploying token:");
  console.error(err);
  process.exit(1);
});
