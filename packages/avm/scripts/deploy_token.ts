import { AztecAddress } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { aztecSetup } from "./lib/aztec-setup.js";

const MINTER_ADDRESS = process.env.MINTER_ADDRESS;

async function main(): Promise<void> {
  await aztecSetup.setupPXE();
  const deployer = await aztecSetup.getOrCreateWallet("deployer");
  console.log("Deployer address:", deployer.getAddress().toString());

  const deployTxOptions = await aztecSetup.getTxOptions(deployer.getAddress());
  const contract = await TokenContract.deploy(
    deployer,
    deployer.getAddress(),
    "Aztec USD",
    "AUSD",
    18
  ).send(deployTxOptions).deployed();

  console.log("[OK] Token deployed at:", contract.address.toString());

  // Save contract address
  aztecSetup.saveContractAddress("token", contract.address.toString());

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
    const txOptions = await aztecSetup.getTxOptions(deployer.getAddress());

    const setMinterTx = await contract.methods
      .set_minter(minterAddress, true)
      .send(txOptions)
      .wait();

    console.log("[OK] Minter set successfully, tx hash:", setMinterTx.txHash.toString());
  } catch (error) {
    console.error("[ERROR] Failed to set minter:", error);
  }

  console.log("\n>> Testing mint_to_private...");
  const deployerAddress = deployer.getAddress();
  const mintAmount = 10000000000000n;

  try {
    const txOptions = await aztecSetup.getTxOptions(deployer.getAddress());

    const mintTx = await contract.methods
      .mint_to_private(deployerAddress, mintAmount)
      .send(txOptions)
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