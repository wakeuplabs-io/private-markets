import { Contract, AztecAddress } from "@aztec/aztec.js";
import VaultArtifact from "../vault/target/vault-BetVault.json";
import { aztecSetup } from "./lib/aztec-setup.js";

async function main(): Promise<void> {
  await aztecSetup.setupPXE();
  const user = await aztecSetup.getOrCreateWallet("user");

  // Load vault address from contract registry
  const vaultAddress = aztecSetup.loadContractAddress("vault");

  if (!vaultAddress) {
    throw new Error("No vault address found. Please deploy the vault first using deploy_vault.ts");
  }

  console.log("Using vault at:", vaultAddress);
  const vault = await Contract.at(AztecAddress.fromString(vaultAddress), VaultArtifact, user);

  const marketId = 1n;
  const outcome = 0;
  const amount = 100n;
  const commitment = 12345n;
  const betId = 42n;
  const nonce = 1n;
  const msg = Array(7).fill(new Uint8Array(31));

  console.log(">> Sending bet...");

  const txOptions = await aztecSetup.getTxOptions(user.getAddress());

  const tx = await vault.methods
    .bet(marketId, outcome, amount, commitment, betId, nonce, user.getAddress(), msg)
    .send(txOptions)
    .wait();

  console.log("[OK] Bet tx sent! Hash:", tx.txHash);
}

main().catch((err) => {
  console.error("Error calling bet:", err);
  process.exit(1);
});