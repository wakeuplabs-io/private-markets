import {
  createPXEClient,
  waitForPXE,
  AztecAddress,
  type PXE,
} from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BetVaultContract } from "../vault/artifacts/BetVault";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PXE_URL = process.env.PXE_URL || "http://localhost:8080";
const MINTER_ADDRESS = process.env.MINTER_ADDRESS;

function bigintToString(bigintValue: bigint): string {
  const hex = bigintValue.toString(16);
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (byte !== 0) {
      result += String.fromCharCode(byte);
    }
  }
  return result;
}

function fieldToString(field: unknown): string {
  if (field && typeof field === 'object' && field !== null && 'value' in field) {
    const fieldObj = field as { value: unknown };
    if (typeof fieldObj.value === 'bigint') {
      return bigintToString(fieldObj.value);
    }
  }

  if (typeof field === 'string') return field;
  if (typeof field === 'bigint') return bigintToString(field);

  if (field && typeof field === 'object' && field !== null && 'toString' in field && typeof field.toString === 'function') {
    return field.toString();
  }

  return String(field);
}

interface Addresses {
  tokenAddress?: string;
  vaultAddress?: string;
  wormholeAddress?: string;
}

async function main(): Promise<void> {
  const pxe: PXE = createPXEClient(PXE_URL);
  await waitForPXE(pxe);

  const [deployer] = await getInitialTestAccountsWallets(pxe);
  console.log("Deployer address:", deployer.getAddress().toString());

  const providedTokenAddress = process.argv[2];

  const addressesPath = path.join(__dirname, "addresses.json");
  let addresses: Addresses = {};

  try {
    const addressesData = fs.readFileSync(addressesPath, "utf8");
    addresses = JSON.parse(addressesData);
  } catch (error) {
    console.warn("No addresses.json found, creating new one");
  }

  let finalTokenAddress: string;

  if (providedTokenAddress) {
    console.log(">> Using existing token at:", providedTokenAddress);
    finalTokenAddress = providedTokenAddress;
  } else {
    console.log(">> No token address provided, deploying new token...");

    const tokenContract = await TokenContract.deploy(
      deployer,
      deployer.getAddress(),
      "Aztec USD",
      "AUSD",
      18
    ).send().deployed();

    finalTokenAddress = tokenContract.address.toString();
    console.log("[OK] New token deployed at:", finalTokenAddress);

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
      const setMinterTx = await tokenContract.methods
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
      const mintTx = await tokenContract.methods
        .mint_to_private(deployerAddress, deployerAddress, mintAmount)
        .send()
        .wait();

      console.log("[OK] Mint successful, tx hash:", mintTx.txHash.toString());

      const privateBalance = await tokenContract.methods
        .balance_of_private(deployerAddress)
        .simulate();

      console.log("[OK] Private balance:", privateBalance.toString());
      console.log("[OK] Expected amount:", mintAmount.toString());

    } catch (error) {
      console.error("[ERROR] Mint test failed:", error);
    }
  }

  console.log("\n>> Reading token information from contract...");
  try {
    const tokenContract = await TokenContract.at(
      AztecAddress.fromString(finalTokenAddress),
      deployer
    );

    const [name, symbol, decimals] = await Promise.all([
      tokenContract.methods.public_get_name().simulate(),
      tokenContract.methods.public_get_symbol().simulate(),
      tokenContract.methods.public_get_decimals().simulate()
    ]);

    console.log("[OK] Token name:", fieldToString(name));
    console.log("[OK] Token symbol:", fieldToString(symbol));
    console.log("[OK] Token decimals:", decimals.toString());
  } catch (error) {
    console.error("[ERROR] Failed to read token information:", error);
  }

  // Deploy vault with token address
  console.log("\n>> Deploying vault with token address:", finalTokenAddress);

  const contract = await BetVaultContract.deploy(
    deployer,
    AztecAddress.fromString(finalTokenAddress)
  ).send().deployed();

  console.log("[OK] Vault deployed at:", contract.address.toString());

  const wormholeAddress = "0x1111111111111111111111111111111111111111111111111111111111111111";

  // Save addresses
  const updatedAddresses: Addresses = {
    ...addresses,
    tokenAddress: finalTokenAddress,
    vaultAddress: contract.address.toString(),
    wormholeAddress,
  };

  fs.writeFileSync(
    addressesPath,
    JSON.stringify(updatedAddresses, null, 2)
  );

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("  Token:    ", finalTokenAddress);
  console.log("  Vault:    ", contract.address.toString());
  console.log("  Wormhole: ", wormholeAddress);
  console.log("  Saved to: addresses.json");
}

main().catch((err) => {
  console.error("Error deploying vault:", err);
  process.exit(1);
});