import { AztecAddress } from "@aztec/aztec.js";
import { aztecSetup } from "./lib/aztec-setup.js";

async function main(): Promise<void> {
  console.log("🔍 Checking Account Deployment Status...\n");

  await aztecSetup.setupPXE();
  const network = aztecSetup.getNetwork();
  console.log(`Network: ${network.toUpperCase()}\n`);

  const pxe = aztecSetup.getPXE();

  // Load account info from files
  const accountsFile = aztecSetup.loadAllAccounts();

  if (!accountsFile || Object.keys(accountsFile).length === 0) {
    console.log("❌ No accounts found in accounts.json");
    return;
  }

  console.log("=== CHECKING ACCOUNTS ===\n");

  for (const [accountName, info] of Object.entries(accountsFile)) {
    console.log(`📝 Account: ${accountName}`);
    console.log(`   Address: ${info.address}`);
    console.log(`   Status in file: ${info.deployed ? "✅ Deployed" : "❌ Not Deployed"}`);

    const address = AztecAddress.fromString(info.address);

    // Check if account is registered in PXE
    try {
      const registeredAccounts = await pxe.getRegisteredAccounts();
      const isRegistered = registeredAccounts.some(
        (acc) => acc.toString() === address.toString()
      );
      console.log(`   PXE registration: ${isRegistered ? "✅ Registered" : "❌ Not Registered"}`);
    } catch (error) {
      console.log(`   PXE registration: ❌ Error checking`);
    }

    // Check if contract instance exists on node
    try {
      const nodeClient = aztecSetup.getNodeClient();
      if (nodeClient) {
        const instance = await nodeClient.getContract(address);
        if (instance) {
          console.log(`   On-chain status: ✅ CONTRACT DEPLOYED`);
          console.log(`   Deployer: ${instance.deployer?.toString() || "N/A"}`);
          console.log(`   Contract class: ${instance.contractClassId?.toString() || "N/A"}`);
        } else {
          console.log(`   On-chain status: ❌ CONTRACT NOT DEPLOYED`);
        }
      } else {
        console.log(`   On-chain status: ⚠️  Cannot check (sandbox mode)`);
      }
    } catch (error) {
      console.log(`   On-chain status: ❌ CONTRACT NOT DEPLOYED`);
    }

    console.log("");
  }

  console.log("=========================\n");

  // Try to create wallets and check if they can be used
  console.log("=== TESTING WALLET CREATION ===\n");

  for (const accountName of Object.keys(accountsFile)) {
    console.log(`🔑 Testing wallet: ${accountName}`);
    try {
      const wallet = await aztecSetup.getOrCreateWallet(accountName);
      const address = wallet.getAddress();
      console.log(`   ✅ Wallet loaded successfully`);
      console.log(`   Address: ${address.toString()}`);

      // Check if account can interact with contracts
      try {
        const nodeInfo = await pxe.getNodeInfo();
      } catch (error) {
        console.log(`   Node info: Error getting node information`);
      }
    } catch (error) {
      console.log(`   ❌ Failed to load wallet`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    console.log("");
  }

  console.log("===============================");
}

main().catch((err) => {
  console.error("❌ Error checking accounts:", err);
  process.exit(1);
});
