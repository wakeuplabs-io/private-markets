import {
  createPXEClient,
  waitForPXE,
  AztecAddress,
  type PXE,
} from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { TokenContract } from "@aztec/noir-contracts.js/Token";

const PXE_URL = process.env.PXE_URL || "http://localhost:8080";

async function main(): Promise<void> {
  const pxe: PXE = createPXEClient(PXE_URL);
  await waitForPXE(pxe);

  const [deployer, alice] = await getInitialTestAccountsWallets(pxe);
  console.log("Deployer address:", deployer.getAddress().toString());

  const contractAddress = "0x239cb0e33ec347a7d511e15a6d4c8dbb508ac541e4991797378ded81a0192fed";
  const azguardAddress = "0x0f55a101b1c11195e1349acdc34087f7896a62a4e96ddd73cbe16279c1f8e145";

  const contract = await TokenContract.at(AztecAddress.fromString(contractAddress), deployer);

  // Register Azguard address with PXE so it can read private notes
  console.log(">> Registering Azguard address with PXE...");
  try {
    await pxe.registerSender(AztecAddress.fromString(azguardAddress));
    console.log("[OK] Azguard address registered with PXE");
  } catch (error) {
    console.warn("[WARN] Failed to register Azguard address (may already be registered):", error);
  }

  console.log(">> Minting to Azguard wallet...");
  const mintAmount = 5000000000000n;
  console.log("deployer address:", deployer.getAddress().toString());
  try {
    const mintTx = await contract.methods
      .mint_to_private(
        deployer.getAddress(),
        AztecAddress.fromString(azguardAddress),
        mintAmount
      )
      .send()
      .wait();
    
      const mintTxOwner = await contract.methods
      .mint_to_private(
        deployer.getAddress(),
        deployer.getAddress(),
        mintAmount
      )
      .send()
      .wait();
    const mintTxAlice = await contract.methods
      .mint_to_private(
        alice.getAddress(),
        alice.getAddress(),
        mintAmount
      )
      .send()
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