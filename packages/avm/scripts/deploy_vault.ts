import {
  createPXEClient,
  waitForPXE,
  Contract,
  AztecAddress,
  type PXE,
} from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import VaultArtifact from "../vault/target/vault-BetVault.json";
import { BetVaultContract } from "../vault/artifacts/BetVault";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PXE_URL = process.env.PXE_URL || "http://localhost:8080";

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

  // Parse command line arguments
  const providedTokenAddress = process.argv[2];

  const addressesPath = path.join(__dirname, "addresses.json");
  let addresses: Addresses = {};

  try {
    const addressesData = fs.readFileSync(addressesPath, "utf8");
    addresses = JSON.parse(addressesData);
  } catch (error) {
    console.warn("No addresses.json found, creating new one");
  }

  // Handle token deployment or use existing
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
  }

  // Deploy vault with token address
  console.log(">> Deploying vault with token address:", finalTokenAddress);

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