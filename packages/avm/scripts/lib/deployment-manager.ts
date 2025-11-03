import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the package root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..", "..");

// Load .env from package root first
const packageEnvPath = path.join(packageRoot, ".env");
const packageEnvResult = config({ path: packageEnvPath });

// Also try to load from monorepo root (2 levels up) - don't override existing vars
const monorepoRoot = path.resolve(packageRoot, "..", "..");
const monorepoEnvPath = path.join(monorepoRoot, ".env");
const monorepoEnvResult = config({ path: monorepoEnvPath, override: false });

// Log which .env files were loaded (only in debug mode)
if (process.env.DEBUG) {
  console.log("🔧 Environment files:");
  console.log(`   Package .env: ${packageEnvResult.error ? '❌ Not found' : '✅ Loaded'} (${packageEnvPath})`);
  console.log(`   Monorepo .env: ${monorepoEnvResult.error ? '❌ Not found' : '✅ Loaded'} (${monorepoEnvPath})`);
}
/**
 * Supported Aztec networks
 */
export type NetworkType = "sandbox" | "testnet";

/**
 * Deployment Manager
 *
 * Handles network detection and provides paths to deployment artifacts.
 * Supports multiple networks with isolated deployment state.
 */
export class DeploymentManager {
  private network: NetworkType;
  private deploymentsRoot: string;

  constructor(network?: NetworkType) {
    this.network = network || this.detectNetworkFromEnv();
    this.deploymentsRoot = path.join(packageRoot, "deployments", this.network);
  }

  /**
   * Get the current network
   */
  getNetwork(): NetworkType {
    return this.network;
  }

  /**
   * Get the deployments directory for the current network
   */
  getDeploymentsDir(): string {
    return this.deploymentsRoot;
  }

  /**
   * Get path to contracts.json file
   */
  getContractsFile(): string {
    return path.join(this.deploymentsRoot, "contracts.json");
  }

  /**
   * Get path to accounts.json file
   */
  getAccountsFile(): string {
    return path.join(this.deploymentsRoot, "accounts.json");
  }

  /**
   * Get path to keys.json file (sensitive)
   */
  getKeysFile(): string {
    return path.join(this.deploymentsRoot, "keys.json");
  }

  /**
   * Get path to PXE store directory
   */
  getPXEStoreDir(): string {
    return path.join(this.deploymentsRoot, "pxe-store");
  }

  /**
   * Detect network from environment variables
   *
   * Priority:
   * 1. AZTEC_NETWORK (explicit: "sandbox" | "testnet")
   * 2. NODE_URL (implicit: localhost = sandbox, else = testnet)
   * 3. PXE_URL (implicit: localhost = sandbox, else = testnet)
   * 4. Default: testnet
   */
  private detectNetworkFromEnv(): NetworkType {
    // Priority 1: Explicit network env var
    const explicitNetwork = process.env.AZTEC_NETWORK;
    if (explicitNetwork === "sandbox" || explicitNetwork === "testnet") {
      console.log(`🌐 Network: ${explicitNetwork} (from AZTEC_NETWORK)`);
      return explicitNetwork;
    }

    // Priority 2: Infer from NODE_URL or PXE_URL
    const nodeUrl = process.env.NODE_URL || process.env.PXE_URL;
    if (nodeUrl) {
      const isLocal =
        nodeUrl.includes("localhost") ||
        nodeUrl.includes("127.0.0.1") ||
        nodeUrl.includes("0.0.0.0") ||
        nodeUrl.includes("8080"); // Sandbox default port

      const detectedNetwork: NetworkType = isLocal ? "sandbox" : "testnet";
      const urlSource = process.env.NODE_URL ? "NODE_URL" : "PXE_URL";
      console.log(`🌐 Network: ${detectedNetwork} (detected from ${urlSource}: ${nodeUrl})`);
      return detectedNetwork;
    }

    // Default: testnet
    console.log(`🌐 Network: testnet (default, no env vars set)`);
    console.log(`   💡 Tip: Set NODE_URL or AZTEC_NETWORK to change network`);
    return "testnet";
  }

  /**
   * Log deployment info
   */
  logDeploymentInfo(): void {
    console.log("\n📍 Deployment Configuration");
    console.log(`   Network: ${this.network}`);
    console.log(`   Deployments: ${this.deploymentsRoot}`);
    console.log(`   Contracts: ${this.getContractsFile()}`);
    console.log(`   Accounts: ${this.getAccountsFile()}`);
    console.log("");
  }
}

/**
 * Get deployment manager instance
 *
 * @param network Optional explicit network selection
 * @returns DeploymentManager instance
 */
export function getDeploymentManager(network?: NetworkType): DeploymentManager {
  return new DeploymentManager(network);
}
