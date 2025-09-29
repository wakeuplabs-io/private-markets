import { registerAztecProvider, getDefaultAztecConfig } from "./aztec";
import { walletService } from "@/services/walletService";

export async function initializeAztecWallet() {
  try {
    // Register the Aztec provider with default configuration
    const config = getDefaultAztecConfig();
    registerAztecProvider(config);

    console.log("Aztec wallet provider registered successfully");
    console.log("Available wallet features:");
    console.log("- connect() - Connect to existing account");
    console.log("- createAccount() - Create new account");
    console.log("- connectTestAccount(index) - Connect test account");
    console.log("- sendTransaction(interaction) - Send transactions");
    console.log("- simulateTransaction(interaction) - Simulate transactions");
    console.log("- registerContract(artifact, deployer, salt, args) - Register contracts");

    return true;
  } catch (error) {
    console.error("Failed to initialize Aztec wallet:", error);
    return false;
  }
}

export async function testWalletOperations() {
  console.log("Testing wallet operations...");

  try {
    // Test creating a new account
    console.log("Creating new account...");
    const newAccount = await walletService.createAccount("aztec", {
      accountType: "ecdsa",
      saveToStorage: true
    });
    console.log("Account created:", newAccount);

    // Test sending a transaction
    console.log("Testing transaction sending...");
    await walletService.sendTransaction({ mockTransaction: true });
    console.log("Transaction sent successfully");

    // Test simulating a transaction
    console.log("Testing transaction simulation...");
    const simulationResult = await walletService.simulateTransaction({ mockSimulation: true });
    console.log("Simulation result:", simulationResult);

    // Test connecting test account
    console.log("Testing test account connection...");
    const testAccount = await walletService.connectTestAccount("aztec", 0);
    console.log("Test account connected:", testAccount);

    // Test contract registration
    console.log("Testing contract registration...");
    await walletService.registerContract(
      { mockArtifact: true },
      { mockDeployer: true },
      { mockSalt: true },
      []
    );
    console.log("Contract registered successfully");

    console.log("All wallet operations completed successfully!");
    return true;
  } catch (error) {
    console.error("Wallet operation failed:", error);
    return false;
  }
}

export function logWalletState() {
  const walletInfo = walletService.getWalletInfo();
  console.log("Current wallet state:", walletInfo);
  console.log("Is connected:", walletService.isConnected());
  console.log("Current connector:", walletService.getCurrentConnector());
}