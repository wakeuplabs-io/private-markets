import {
  AztecAddress,
  createPXEClient,
  waitForPXE,
  type PXE,
} from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { TokenContract } from "@aztec/noir-contracts.js/Token";

const PXE_URL = process.env.PXE_URL || "http://localhost:8080";

async function main(): Promise<void> {
  const pxe: PXE = createPXEClient(PXE_URL);
  await waitForPXE(pxe);

  const [deployer] = await getInitialTestAccountsWallets(pxe);
  console.log("Deployer address:", deployer.getAddress().toString());

  const contract = await TokenContract.deploy(
    deployer,
    deployer.getAddress(),
    "Aztec USD",
    "AUSD",
    18
  ).send().deployed();

  console.log("✅ Token deployed at:", contract.address.toString());

  const minterAddress = AztecAddress.fromString("0x0f55a101b1c11195e1349acdc34087f7896a62a4e96ddd73cbe16279c1f8e145");
  console.log("\n🔧 Setting minter to:", minterAddress.toString());

  try {
    const setMinterTx = await contract.methods
      .set_minter(minterAddress, true)
      .send()
      .wait();

    console.log("✅ Minter set successfully, tx hash:", setMinterTx.txHash.toString());
  } catch (error) {
    console.error("❌ Failed to set minter:", error);
  }

  console.log("\n🧪 Testing mint_to_private...");
  const deployerAddress = deployer.getAddress();
  const mintAmount = 10000000000000n;

  try {
    const mintTx = await contract.methods
      .mint_to_private(deployerAddress, deployerAddress, mintAmount)
      .send()
      .wait();

    console.log("✅ Mint successful, tx hash:", mintTx.txHash.toString());

    const privateBalance = await contract.methods
      .balance_of_private(deployerAddress)
      .simulate();

    console.log("✅ Private balance:", privateBalance.toString());
    console.log("✅ Expected amount:", mintAmount.toString());
    console.log("✅ Balance matches:", privateBalance === mintAmount ? "YES" : "NO");

  } catch (error) {
    console.error("❌ Mint test failed:", error);
  }
}

main().catch((err) => {
  console.error("Error deploying token:", err);
  process.exit(1);
});