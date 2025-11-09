import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { aztecSetup } from "../lib/aztec-setup.js";

async function main(): Promise<void> {
  console.log("🔍 Checking Account Deployment Status...\n");

  await aztecSetup.initialize();
  const network = aztecSetup.getNetwork();
  console.log(`Network: ${network.toUpperCase()}\n`);

  const pxe = aztecSetup.getPXE();

  const accountsFile = aztecSetup.loadAllAccounts();

  if (!accountsFile || Object.keys(accountsFile).length === 0) {
    console.log("No accounts found in accounts.json");
    return;
  }

  console.log("=== CHECKING ACCOUNTS ===\n");

  for (const [accountName, info] of Object.entries(accountsFile)) {
    console.log(`📝 Account: ${accountName}`);
    console.log(`   Address: ${info.address}`);
    console.log(`   Status in file: ${info.deployed ? "✅ Deployed" : "Not Deployed"}`);

    const address = AztecAddress.fromString(info.address);

    try {
      const contractInstance = await pxe.getContractInstance(address);
      const isRegistered = contractInstance !== undefined;
      console.log(`   PXE registration: ${isRegistered ? "✅ Registered" : "Not Registered"}`);
    } catch (error) {
      console.log(`   PXE registration: Not found in PXE`);
    }

    try {
      const node = aztecSetup.getNode();
      const instance = await node.getContract(address);
      if (instance) {
        console.log(`   On-chain status: CONTRACT DEPLOYED`);
        console.log(`   Deployer: ${instance.deployer?.toString() || "N/A"}`);
      } else {
        console.log(`   On-chain status: CONTRACT NOT DEPLOYED`);
      }
    } catch (error) {
      console.log(`   On-chain status: CONTRACT NOT DEPLOYED`);
    }

    console.log("");
  }

  console.log("=========================\n");

  // Try to create accounts and check if they can be used
  console.log("=== TESTING ACCOUNT LOADING ===\n");

  for (const accountName of Object.keys(accountsFile)) {
    console.log(`🔑 Testing account: ${accountName}`);
    try {
      const address = await aztecSetup.getOrCreateAccount(accountName);
      console.log(`   Account loaded successfully`);
      console.log(`   Address: ${address.toString()}`)
    } catch (error) {
      console.log(`   Failed to load account`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("");
  }

  console.log("==============================");
}

main().catch((err) => {
  console.error("Error checking accounts:", err);
  process.exit(1);
});
