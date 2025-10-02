/**
 * Vault Service Module
 *
 * Provides vault contract interaction capabilities with automatic provider selection
 * based on wallet connection status.
 *
 * Usage:
 * ```typescript
 * import { vaultService } from '@/services/vault';
 *
 * // Place a bet
 * const txHash = await vaultService.placeBet({
 *   marketId: '1',
 *   outcome: 1,
 *   amount: 1000,
 *   userAddress: address
 * });
 *
 * // Check if bet is processed
 * const processed = await vaultService.isBetProcessed(betId);
 *
 * // Get associated token address
 * const tokenAddress = await vaultService.getTokenAddress();
 * ```
 *
 * @module services/vault
 */

// Main service exports
export { VaultService, vaultService } from './VaultService';

// Provider exports (for testing or advanced usage)
export { PrivateVaultProvider } from './PrivateVaultProvider';
export { PublicVaultProvider } from './PublicVaultProvider';

// Type exports
export type { IVaultService, IVaultProvider, BetParams, SimpleBetParams } from './types';
export { FALLBACK_VALUES } from './types';

// Default export
export { vaultService as default } from './VaultService';
