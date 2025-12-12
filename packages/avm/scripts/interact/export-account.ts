/**
 * Export account data in frontend-compatible format
 *
 * Usage:
 *   npm run sandbox:export:account -- deployer
 *   npm run export:account -- executor
 *
 * Outputs JSON you can paste into browser localStorage:
 *   localStorage.setItem("aztec-account", '<output>');
 */

import { Fr, GrumpkinScalar } from "@aztec/foundation/fields";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { SchnorrAccountContract } from "@aztec/accounts/schnorr";
import { AccountManager } from "@aztec/aztec.js/wallet";
import fs from "fs";
import path from "path";

const network = process.env.AZTEC_NETWORK || "testnet";
const accountName = process.argv[2] || "executor";

const deploymentsDir = path.join(process.cwd(), "deployments", network);
const keysFile = path.join(deploymentsDir, "keys.json");
const accountsFile = path.join(deploymentsDir, "accounts.json");

if (!fs.existsSync(keysFile)) {
  console.error(`Keys file not found: ${keysFile}`);
  process.exit(1);
}

if (!fs.existsSync(accountsFile)) {
  console.error(`Accounts file not found: ${accountsFile}`);
  process.exit(1);
}

const keys = JSON.parse(fs.readFileSync(keysFile, "utf8"));
const accounts = JSON.parse(fs.readFileSync(accountsFile, "utf8"));

if (!keys[accountName]) {
  console.error(`Account "${accountName}" not found in keys.json`);
  console.error(`Available accounts: ${Object.keys(keys).join(", ")}`);
  process.exit(1);
}

if (!accounts[accountName]) {
  console.error(`Account "${accountName}" not found in accounts.json`);
  process.exit(1);
}

const accountKeys = keys[accountName];
const accountInfo = accounts[accountName];

// Derive signingKey from privateKey (secretKey)
const secretKey = Fr.fromHexString(accountKeys.privateKey);
const salt = Fr.fromHexString(accountKeys.salt);
const signingKey = deriveSigningKey(secretKey);

// Convert signingKey to hex (same format as frontend)
const signingKeyHex = signingKey.toBuffer().toString("hex");

// Build frontend-compatible format
const frontendData = {
  address: accountInfo.address,
  signingKey: signingKeyHex,
  secretKey: accountKeys.privateKey,
  salt: accountKeys.salt,
};

console.log(`\n📦 Account: ${accountName} (${network})`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`\nPaste in browser console:\n`);
console.log(`localStorage.setItem("aztec-account", '${JSON.stringify(frontendData)}');`);
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
