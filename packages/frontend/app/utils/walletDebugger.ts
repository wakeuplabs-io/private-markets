import { walletService } from "@/services/walletService";

/**
 * Testing functions for wallet operations
 * Used for debugging and development purposes only
 */

export async function testWalletOperations(): Promise<boolean> {
  console.log("🧪 Testing wallet operations...");

  try {
    // Test creating a new account
    console.log("📝 Creating new account...");
    const newAccount = await walletService.createAccount("aztec", {
      accountType: "schnorr",
      saveToStorage: true
    });
    console.log("✅ Account created:", newAccount);

    // Test sending a transaction (with mock data for testing)
    console.log("📤 Testing transaction sending...");
    await walletService.sendTransaction({ mockTransaction: true });
    console.log("✅ Transaction sent successfully");

    // Test simulating a transaction (with mock data for testing)
    console.log("🔮 Testing transaction simulation...");
    const simulationResult = await walletService.simulateTransaction({ mockSimulation: true });
    console.log("✅ Simulation result:", simulationResult);

    // Test connecting test account
    console.log("🔗 Testing test account connection...");
    const testAccount = await walletService.connectTestAccount("aztec", 0);
    console.log("✅ Test account connected:", testAccount);

    // Test contract registration (with mock data for testing)
    console.log("📋 Testing contract registration...");
    await walletService.registerContract(
      { mockArtifact: true },
      { mockDeployer: true },
      { mockSalt: true },
      []
    );
    console.log("✅ Contract registered successfully");

    console.log("🎉 All wallet operations completed successfully!");
    return true;
  } catch (error) {
    console.error("❌ Wallet operation failed:", error);
    return false;
  }
}

export function logWalletState(): void {
  console.log("📊 Current Wallet State:");
  console.log("------------------------");

  const walletInfo = walletService.getWalletInfo();
  console.log("Wallet Info:", walletInfo);
  console.log("Is Connected:", walletService.isConnected());
  console.log("Current Connector:", walletService.getCurrentConnector());

  if (walletInfo) {
    console.log("Address:", walletInfo.address);
    console.log("Connector:", walletInfo.connector);
  } else {
    console.log("No wallet connected");
  }
}

/**
 * Comprehensive wallet debugging session
 * Runs all tests and logs state
 */
export async function debugWalletSession(): Promise<void> {
  console.log("Starting comprehensive wallet debugging session...");

  logWalletState();
  console.log("");

  const success = await testWalletOperations();
  console.log("");

  logWalletState();
  console.log("");

  if (success) {
    console.log("Debugging session completed successfully");
  } else {
    console.log("Debugging session failed");
  }
}