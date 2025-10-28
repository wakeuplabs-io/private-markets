/**
 * Contract Configuration and Re-exports
 *
 * This module centralizes contract-related exports for backward compatibility
 * and provides a single import point for contract ABIs and constants.
 *
 * Note: ABIs have been moved to @/constants/abis/ for better organization.
 * Contract-specific constants are in @/constants/contracts/[contractName].ts
 */

// Re-export ABIs for backward compatibility
export { PREDICTION_MARKET_ABI, ERC20_ABI } from './abis';
export { PREDICTION_MARKET_FUNCTIONS, PREDICTION_MARKET_GAS_LIMITS, PREDICTION_MARKET_PAGINATION } from './contracts/predictionMarket';
// Re-export contract constants
export * from './contracts';
