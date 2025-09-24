import { AztecAddress } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { BetVaultContract } from "../vault/artifacts/BetVault";
import { aztecSetup } from "./lib/aztec-setup.js";
import { fieldToString } from "./lib/utils.js";

const MINTER_ADDRESS = process.env.MINTER_ADDRESS;

async function main(): Promise<void> {
  await aztecSetup.setupPXE();
  const deployer = await aztecSetup.getOrCreateWallet("deployer");
  console.log("Deployer address:", deployer.getAddress().toString());

  const providedTokenAddress = process.argv[2];
  let finalTokenAddress: string;

  if (providedTokenAddress) {
    console.log(">> Using existing token at:", providedTokenAddress);
    finalTokenAddress = providedTokenAddress;
  } else {
    // Try to load existing token address first
    const existingTokenAddress = aztecSetup.loadContractAddress("token");
    if (existingTokenAddress) {
      console.log(">> Using existing token from contracts.json:", existingTokenAddress);
      finalTokenAddress = existingTokenAddress;
    } else {
      console.log(">> No token address provided, deploying new token...");

      const deployTxOptions = await aztecSetup.getTxOptions(deployer.getAddress());
      const tokenContract = await TokenContract.deploy(
        deployer,
        deployer.getAddress(),
        "Aztec USD",
        "AUSD",
        18
      ).send(deployTxOptions).deployed();

      finalTokenAddress = tokenContract.address.toString();
      console.log("[OK] New token deployed at:", finalTokenAddress);

      // Save the new token address
      aztecSetup.saveContractAddress("token", finalTokenAddress);

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

        const setMinterTx = await tokenContract.methods
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

        const mintTx = await tokenContract.methods
          .mint_to_private(deployerAddress, mintAmount)
          .send(txOptions)
          .wait();

        console.log("[OK] Mint successful, tx hash:", mintTx.txHash.toString());

        const mintTxMinter = await tokenContract.methods
          .mint_to_private(minterAddress, mintAmount)
          .send(txOptions)
          .wait();

        console.log("[OK] Mint successful, tx hash:", mintTxMinter.txHash.toString());

        const privateBalance = await tokenContract.methods
          .balance_of_private(deployerAddress)
          .simulate({ from: deployer.getAddress() });

        console.log("[OK] Private balance:", privateBalance.toString());
        console.log("[OK] Expected amount:", mintAmount.toString());

      } catch (error) {
        console.error("[ERROR] Mint test failed:", error);
      }
    }
  }

  console.log("\n>> Reading token information from contract...");
  try {
    const tokenContract = await TokenContract.at(
      AztecAddress.fromString(finalTokenAddress),
      deployer
    );

    const [name, symbol, decimals] = await Promise.all([
      tokenContract.methods.public_get_name().simulate({ from: deployer.getAddress() }),
      tokenContract.methods.public_get_symbol().simulate({ from: deployer.getAddress() }),
      tokenContract.methods.public_get_decimals().simulate({ from: deployer.getAddress() })
    ]);

    console.log("[OK] Token name:", fieldToString(name));
    console.log("[OK] Token symbol:", fieldToString(symbol));
    console.log("[OK] Token decimals:", decimals.toString());
  } catch (error) {
    console.error("[ERROR] Failed to read token information:", error);
  }

  // Deploy vault with token address
  console.log("\n>> Deploying vault with token address:", finalTokenAddress);

  const vaultDeployTxOptions = await aztecSetup.getTxOptions(deployer.getAddress());
  const contract = await BetVaultContract.deploy(
    deployer,
    AztecAddress.fromString(finalTokenAddress)
  ).send(vaultDeployTxOptions).deployed();

  console.log("[OK] Vault deployed at:", contract.address.toString());

  // Save vault address to our system
  aztecSetup.saveContractAddress("vault", contract.address.toString());

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("  Token: ", finalTokenAddress);
  console.log("  Vault: ", contract.address.toString());
  console.log("  Contracts saved to: deploys/contracts.json");
}

main().catch((err) => {
  console.error("Error deploying vault:", err);
  process.exit(1);
});