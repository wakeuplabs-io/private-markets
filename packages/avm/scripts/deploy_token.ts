import {
  AztecAddress,
  createPXEClient,
  waitForPXE,
  type PXE,
} from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { TokenContract } from "@aztec/noir-contracts.js/Token";

const PXE_URL = process.env.PXE_URL || "http://localhost:8080";
const MINTER_ADDRESS = process.env.MINTER_ADDRESS;

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

  console.log("[OK] Token deployed at:", contract.address.toString());

  const minterAddress = MINTER_ADDRESS
    ? AztecAddress.fromString(MINTER_ADDRESS)
    : deployer.getAddress();

  console.log("\n>> Setting minter to:", minterAddress.toString());
  if (MINTER_ADDRESS) {
    console.log("   (from MINTER_ADDRESS env var)");
  } else {
    console.log("   (using deployer address as default)");
  }

  try {
    const setMinterTx = await contract.methods
      .set_minter(minterAddress, true)
      .send()
      .wait();

    console.log("[OK] Minter set successfully, tx hash:", setMinterTx.txHash.toString());
  } catch (error) {
    console.error("[ERROR] Failed to set minter:", error);
  }

  console.log("\n>> Testing mint_to_private...");
  const deployerAddress = deployer.getAddress();
  const mintAmount = 10000000000000n;

  try {
    const mintTx = await contract.methods
      .mint_to_private(deployerAddress, deployerAddress, mintAmount)
      .send()
      .wait();

    console.log("[OK] Mint successful, tx hash:", mintTx.txHash.toString());

    const privateBalance = await contract.methods
      .balance_of_private(deployerAddress)
      .simulate();

    console.log("[OK] Private balance:", privateBalance.toString());
    console.log("[OK] Expected amount:", mintAmount.toString());

  } catch (error) {
    console.error("[ERROR] Mint test failed:", error);
  }
}

main().catch((err) => {
  console.error("Error deploying token:", err);
  process.exit(1);
});