/**
 * Centralized Configuration Exports
 *
 * Single entry point for all application configuration
 */

// Aztec configuration
export * from './aztec';

// EVM configuration (Wagmi, Arbitrum)
export * from './wagmi';

// Contract addresses and ABIs
export * from './contracts';

/**
 * Usage:
 * import { aztecConfig, config, CONTRACT_ADDRESSES } from '@/config';
 */
