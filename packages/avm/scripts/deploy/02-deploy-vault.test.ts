import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { TxStatus } from "@aztec/aztec.js/tx";
import { BetVaultContract } from "../../artifacts/BetVault.js";
import { aztecTestSetup } from "../lib/aztec-test-setup.js";

async function main(): Promise<void> {
  console.log("🚀 Starting BetVault deployment (TEST MODE - Sandbox)...\n");

  // Get Wormhole address from environment variable
  const WORMHOLE_ADDRESS = "0x0e61ae3f9f51ae20042f48674e2bf1c19cde5c916ae3a5ed114d84c873cc9a8f";

  // Initialize test environment with pre-loaded sandbox accounts
  const { alice } = await aztecTestSetup.initialize();
  const wallet = aztecTestSetup.getWallet();  // Get the ScriptTestWallet
  const deployerAddress = alice.getAddress();  // Use alice's address

  console.log("Deployer (alice):", deployerAddress.toString());

  const providedTokenAddress = process.argv[2];
  let tokenAddress: string;
  if (providedTokenAddress) {
    console.log(">> Using token address from argument:", providedTokenAddress);
    tokenAddress = providedTokenAddress;
  } else {
    const existingTokenAddress = aztecTestSetup.loadContractAddress("token");
    if (!existingTokenAddress) {
      console.error("❌ No token address found. Please:");
      console.error("   1. Run 'npm run sandbox:deploy:token:test' first, OR");
      console.error("   2. Provide token address as argument: npm run sandbox:deploy:vault:test <TOKEN_ADDRESS>");
      process.exit(1);
    }
    console.log(">> Using token address from contracts.json:", existingTokenAddress);
    tokenAddress = existingTokenAddress;
  }

  console.log("\n>> Deploying BetVault contract...");

  const deployTx = BetVaultContract.deploy(
    wallet,
    AztecAddress.fromString(tokenAddress),
    AztecAddress.fromString(WORMHOLE_ADDRESS),
    deployerAddress, // admin address
  ).send({ from: deployerAddress });

  // Get contract address immediately (deterministic)
  const instance = await deployTx.instanceGetter();
  const contractAddress = instance.address;

  console.log("Deployment transaction sent!");
  console.log("   Contract address (deterministic):", contractAddress.toString());

  // Get transaction hash for monitoring
  const txHash = await deployTx.getTxHash();
  console.log("   Transaction hash:", txHash.toString());

  // Step 1: Wait for transaction to be mined (with retry)
  console.log("\n>> Waiting for transaction to be mined...");
  const maxReceiptRetries = 24; // 24 attempts × 5s = 2 minutes max
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
      if (error.message?.includes("reverted") || error.message?.includes("dropped")) {
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
  const contract = await BetVaultContract.at(contractAddress, wallet);

  // Wait a bit for bytecode to propagate
  console.log("   Waiting 5 seconds for bytecode to propagate...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  const maxVerifyRetries = 6; // 6 attempts × 5s = 30 seconds max
  let verified = false;

  for (let attempt = 1; attempt <= maxVerifyRetries; attempt++) {
    try {
      console.log(`   Calling get_token()... (attempt ${attempt}/${maxVerifyRetries})`);
      const tokenAddr = await contract.methods.get_token().simulate({ from: deployerAddress });

      console.log("\n✅ Vault deployed and verified!");
      console.log("   Address:", contract.address.toString());
      console.log("   Token address from contract:", tokenAddr.toString());

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

  aztecTestSetup.saveContractAddress("vault", contract.address.toString());

  console.log("\n=== DEPLOYMENT SUMMARY (TEST MODE) ===");
  console.log("  Token:     ", tokenAddress);
  console.log("  Wormhole:  ", WORMHOLE_ADDRESS);
  console.log("  Vault:     ", contract.address.toString());
  console.log("  Deployer:  ", deployerAddress.toString());
  console.log("  Saved to:   deployments/sandbox-test/contracts.json");
  console.log("========================================");
}

main().catch((err) => {
  console.error("❌ Error deploying vault:", err);
  process.exit(1);
});
