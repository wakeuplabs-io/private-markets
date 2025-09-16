import {
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
}

main().catch((err) => {
  console.error("Error deploying token:", err);
  process.exit(1);
});