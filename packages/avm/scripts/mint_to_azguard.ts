import { AztecAddress } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { aztecSetup } from "./lib/aztec-setup.js";

async function main(): Promise<void> {
  await aztecSetup.setupPXE();
  const deployer = await aztecSetup.getOrCreateWallet("deployer");
  const alice = await aztecSetup.getOrCreateWallet("user");

  console.log("Deployer address:", deployer.getAddress().toString());

  // Try to load token address from our contract registry
  let contractAddress = aztecSetup.loadContractAddress("token");

  if (!contractAddress) {
    throw new Error("No token contract found. Please deploy the token first.");
  }

  console.log("Using token at:", contractAddress);

  // For testnet, we need to create or load azguard account
  // In sandbox, we can use hardcoded addresses for testing
  let azguardAddress: string;

  if (aztecSetup.getNetwork() === "sandbox") {
    // Use hardcoded address for sandbox testing
    azguardAddress = "0x0f55a101b1c11195e1349acdc34087f7896a62a4e96ddd73cbe16279c1f8e145";
  } else {
    // For testnet, create or load azguard account
    const azguardWallet = await aztecSetup.getOrCreateWallet("azguard");
    azguardAddress = azguardWallet.getAddress().toString();
  }

  const contract = await TokenContract.at(AztecAddress.fromString(contractAddress), deployer);

  // Register Azguard address with PXE so it can read private notes
  console.log(">> Registering Azguard address with PXE...");
  await aztecSetup.registerSender(AztecAddress.fromString(azguardAddress));

  console.log(">> Minting to Azguard wallet...");
  const mintAmount = 5000000000000n;
  console.log("deployer address:", deployer.getAddress().toString());

  const txOptions = await aztecSetup.getTxOptions(deployer.getAddress());

  try {
    const mintTx = await contract.methods
      .mint_to_private(
        AztecAddress.fromString(azguardAddress),
        mintAmount
      )
      .send(txOptions)
      .wait();

    const mintTxOwner = await contract.methods
      .mint_to_private(
        deployer.getAddress(),
        mintAmount
      )
      .send(txOptions)
      .wait();

    const aliceTxOptions = await aztecSetup.getTxOptions(alice.getAddress());
    const mintTxAlice = await contract.methods
      .mint_to_private(
        alice.getAddress(),
        mintAmount
      )
      .send(aliceTxOptions)
      .wait();

    console.log("[OK] Mint successful, tx hash:", mintTx.txHash.toString());
    console.log("[OK] Mint successful, tx hash:", mintTxOwner.txHash.toString());
    console.log("[OK] Mint successful, tx hash:", mintTxAlice.txHash.toString());
    // Check balance
    const balance = await contract.methods
      .balance_of_private(AztecAddress.fromString(azguardAddress))
      .simulate();
    
    const balanceOwner = await contract.methods
      .balance_of_private(deployer.getAddress())
      .simulate();

    const balanceAlice = await contract.methods
      .balance_of_private(alice.getAddress())
      .simulate();

    console.log("[OK] Azguard private balance:", balance.toString());
    console.log("[OK] Owner private balance:", balanceOwner.toString());
    console.log("[OK] Alice private balance:", balanceAlice.toString());
    console.log("[OK] Expected amount:", mintAmount.toString());

  } catch (error) {
    console.error("[ERROR] Mint failed:", error);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});