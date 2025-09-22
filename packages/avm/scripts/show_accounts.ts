import { aztecSetup } from "./lib/aztec-setup.js";

async function main(): Promise<void> {
  await aztecSetup.setupPXE();

  aztecSetup.displayAccountStatus();

  const network = aztecSetup.getNetwork();
  console.log(`🔗 Current network: ${network}`);

  if (network === "sandbox") {
    console.log("🏗️  Extracting and saving sandbox account information...");
    await aztecSetup.extractAndSaveSandboxKeys();

    console.log("\n📦 Creating account references...");
    await aztecSetup.getOrCreateWallet("deployer");
    await aztecSetup.getOrCreateWallet("user");

    console.log("\n📊 Final status:");
    aztecSetup.displayAccountStatus();
  } else {
    console.log("🌐 Testnet mode - accounts will be created as needed");

    const createAccounts = process.argv.includes("--create");
    if (createAccounts) {
      console.log("🔐 Creating testnet accounts...");
      await aztecSetup.getOrCreateWallet("deployer");
      await aztecSetup.getOrCreateWallet("user");
      aztecSetup.displayAccountStatus();
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});