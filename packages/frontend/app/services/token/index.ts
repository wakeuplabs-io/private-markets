/**
 * Token Service Module
 *
 * Provides token contract interaction capabilities with automatic provider selection
 * based on wallet connection status.
 *
 * Usage:
 * ```typescript
 * import { tokenService } from '@/services/token';
 *
 * // Get token information
 * const info = await tokenService.getTokenInfo(tokenAddress);
 *
 * // Get private balance
 * const balance = await tokenService.getPrivateBalance(tokenAddress, ownerAddress);
 *
 * // Mint tokens (requires connected wallet)
 * const txHash = await tokenService.mintToPrivate(tokenAddress, recipient, amount);
 * ```
 *
 * @module services/token
 */

// Main service exports
export { TokenService, tokenService } from './tokenService';

// Provider exports (for testing or advanced usage)
export { TokenProvider } from './tokenProvider';

// Type exports
export type { ITokenService, ITokenProvider, TokenInfo } from './types';
export { FALLBACK_VALUES } from './types';

// Default export
export { tokenService as default } from './tokenService';
