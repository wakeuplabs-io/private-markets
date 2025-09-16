import {
  createPXEClient,
  waitForPXE,
  Contract,
  type PXE,
} from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import VaultArtifact from "../vault/target/vault-BetVault.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PXE_URL = process.env.PXE_URL || "http://localhost:8079";

interface Addresses {
  tokenAddress?: string;
  vaultAddress?: string;
  wormholeAddress?: string;
}

async function main(): Promise<void> {
  const pxe: PXE = createPXEClient(PXE_URL);
  await waitForPXE(pxe);

  const [deployer] = await getInitialTestAccountsWallets(pxe);

  // Load token address saved from deploy_token
  const addressesPath = path.join(__dirname, "addresses.json");
  let addresses: Addresses = {};

  try {
    const addressesData = fs.readFileSync(addressesPath, "utf8");
    addresses = JSON.parse(addressesData);
  } catch (error) {
    console.warn("No addresses.json found, creating new one");
  }

  const wormholeAddress = "0x1111111111111111111111111111111111111111111111111111111111111111"; // dummy for now

  const contract = await Contract.deploy(
    deployer,
    VaultArtifact,
    []
  ).send().deployed();

  console.log("✅ Vault deployed at:", contract.address.toString());

  // Save addresses
  const updatedAddresses: Addresses = {
    ...addresses,
    vaultAddress: contract.address.toString(),
    wormholeAddress,
  };

  fs.writeFileSync(
    addressesPath,
    JSON.stringify(updatedAddresses, null, 2)
  );
}

main().catch((err) => {
  console.error("Error deploying vault:", err);
  process.exit(1);
});