/**
 * Aztec Configuration
 *
 * Centralized configuration for Aztec network connections and settings
 */

export const aztecConfig = {
  /**
   * PXE (Private Execution Environment) URL
   * - Sandbox: http://localhost:8080
   * - Testnet: https://aztec-testnet-fullnode.zkv.xyz
   */
  pxeUrl: process.env.NEXT_PUBLIC_PXE_URL || 'http://localhost:8080',

  /**
   * Prover configuration
   * - true: Generate proofs (slower but more secure)
   * - false: Skip proof generation (faster for testing)
   */
  proverEnabled: process.env.NEXT_PUBLIC_PROVER_ENABLED === 'true' || true,

  /**
   * Account type for Aztec wallets
   * Currently only 'schnorr' is supported
   */
  accountType: 'schnorr' as const,

  /**
   * Wormhole chain ID for Aztec
   * Used in cross-chain message encoding
   */
  wormholeChainId: 56,

  /**
   * Contract addresses on Aztec
   */
  contracts: {
    vault: process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS || '',
    token: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS || '',
  },
} as const;

/**
 * Check if running against sandbox (localhost)
 */
export function isSandbox(): boolean {
  const url = aztecConfig.pxeUrl.toLowerCase();
  return url.includes('localhost') || url.includes('127.0.0.1');
}

/**
 * Check if running against testnet
 */
export function isTestnet(): boolean {
  const url = aztecConfig.pxeUrl.toLowerCase();
  return (
    url.includes('aztec-testnet') ||
    (url.includes('testnet') && !isSandbox())
  );
}

/**
 * Get environment name
 */
export function getAztecEnvironment(): 'sandbox' | 'testnet' | 'mainnet' {
  if (isSandbox()) return 'sandbox';
  if (isTestnet()) return 'testnet';
  return 'mainnet'; // Future: support mainnet
}

/**
 * Type exports
 */
export type AztecConfig = typeof aztecConfig;
export type AztecAccountType = typeof aztecConfig.accountType;
export type AztecEnvironment = ReturnType<typeof getAztecEnvironment>;
