import { AztecAddress, Fr, createPXEClient } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { BetVaultContract } from "@/lib/contracts/BetVault";
import type { IVaultProvider, BetParams } from "./types";
import { FALLBACK_VALUES } from "./types";

/**
 * Public Vault Provider (READ-ONLY)
 * Uses PXE test accounts. No write operations.
 */
export class PublicVaultProvider implements IVaultProvider {
  constructor(private contractAddress: string) {}

  async getContract(): Promise<BetVaultContract> {
    try {
      const pxe = createPXEClient(process.env.NEXT_PUBLIC_PXE_URL || "http://localhost:8080");
      const [wallet] = await getInitialTestAccountsWallets(pxe);

      const contract = await BetVaultContract.at(
        AztecAddress.fromString(this.contractAddress),
        wallet
      );

      return contract;
    } catch (error) {
      console.error('[VAULT:PUBLIC] Failed to get vault contract:', error);
      throw new Error(`Failed to get vault contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /** Check if bet was processed */
  async isProcessed(betId: string): Promise<boolean> {
    try {
      const pxe = createPXEClient(process.env.NEXT_PUBLIC_PXE_URL || "http://localhost:8080");
      const [wallet] = await getInitialTestAccountsWallets(pxe);

      const contract = await BetVaultContract.at(
        AztecAddress.fromString(this.contractAddress),
        wallet
      );

      const result = await contract.methods
        .is_processed(Fr.fromString(betId))
        .simulate({ from: wallet.getAddress() });

      return result;
    } catch (error) {
      console.error('[VAULT:PUBLIC] Failed to check bet status:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      if (errorMsg.includes('has not been registered in the wallet\'s PXE')) {
        console.warn('[VAULT:PUBLIC] Contract not registered in PXE, returning fallback value');
      }

      return FALLBACK_VALUES.BET_PROCESSED;
    }
  }

  /**
   * Get the token address associated with the vault using PXE test wallet
   *
   * @returns Token contract address
   */
  async getTokenAddress(): Promise<string> {
    try {
      const pxe = createPXEClient(process.env.NEXT_PUBLIC_PXE_URL || "http://localhost:8080");
      const [wallet] = await getInitialTestAccountsWallets(pxe);

      const contract = await BetVaultContract.at(
        AztecAddress.fromString(this.contractAddress),
        wallet
      );

      const result = await contract.methods
        .get_token_address()
        .simulate({ from: wallet.getAddress() });

      return result.toString();
    } catch (error) {
      console.error('[VAULT:PUBLIC] Failed to get token address:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      if (errorMsg.includes('has not been registered in the wallet\'s PXE')) {
        console.warn('[VAULT:PUBLIC] Contract not registered in PXE, returning fallback value');
      }

      return FALLBACK_VALUES.TOKEN_ADDRESS;
    }
  }

  /**
   * Clear cache (no-op for public provider as it doesn't cache)
   */
  clearCache(): void {
    // Public provider doesn't cache, so nothing to clear
  }
}
