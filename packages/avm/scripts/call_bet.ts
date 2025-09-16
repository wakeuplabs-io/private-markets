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
  vaultAddress: string;
  tokenAddress?: string;
  wormholeAddress?: string;
}

async function main(): Promise<void> {
  const pxe: PXE = createPXEClient(PXE_URL);
  await waitForPXE(pxe);

  const [user] = await getInitialTestAccountsWallets(pxe);

  const addressesPath = path.join(__dirname, "addresses.json");
  const addressesData = fs.readFileSync(addressesPath, "utf8");
  const { vaultAddress }: Addresses = JSON.parse(addressesData);

  const vault = await Contract.at(vaultAddress, VaultArtifact, user);

  const marketId = 1n;
  const outcome = 0;
  const amount = 100n;
  const commitment = 12345n;
  const betId = 42n;
  const nonce = 1n;
  const msg = Array(7).fill(new Uint8Array(31));

  console.log("📤 Sending bet...");
  const tx = await vault.methods
    .bet(marketId, outcome, amount, commitment, betId, nonce, user.getAddress(), msg)
    .send()
    .wait();

  console.log("✅ Bet tx sent! Hash:", tx.txHash);
}

main().catch((err) => {
  console.error("Error calling bet:", err);
  process.exit(1);
});