/**
 * PredictionMarketCore Contract Constants
 *
 * This module provides typed constants for interacting with the PredictionMarketCore
 * smart contract.
 */

export const PREDICTION_MARKET_FUNCTIONS = {
  // Read Functions (view/pure)
  GET_MARKET_COUNT: 'getAllMarketsCount',
  GET_MARKET: 'getMarket',
  GET_MARKETS_BY_OWNER: 'getMarketsByOwner',
  GET_ACTIVE_MARKETS: 'getActiveMarkets',
  GET_MARKET_TOTALS: 'getMarketTotals',
  GET_OWNER_MARKET_COUNT: 'getOwnerMarketCount',
  IS_NULLIFIER_CONSUMED: 'isNullifierConsumed',
  IS_PROCESSED: 'isProcessed',
  OWNER: 'owner',
  TREASURY_CONTRACT: 'treasuryContract',
  WORMHOLE: 'wormhole',
  CHAIN_ID: 'chainId',
  EVM_CHAIN_ID: 'evmChainId',
  FINALITY: 'finality',
  IS_FORK: 'isFork',

  // Write Functions (state-changing)
  CREATE_MARKET: 'createMarket',
  RESOLVE_MARKET: 'resolveMarket',
  PROCESS_BET: 'processBet',
  PROCESS_CLAIM_AUTHORIZATION: 'processClaimAuthorization',
  TRANSFER_OWNERSHIP: 'transferOwnership',
  RENOUNCE_OWNERSHIP: 'renounceOwnership',
} as const;

/**
 * Type for function names
 * Useful for validation and type-safe function calls
 */
export type PredictionMarketFunctionName = typeof PREDICTION_MARKET_FUNCTIONS[keyof typeof PREDICTION_MARKET_FUNCTIONS];

/**
 * Gas limits for contract operations
 *
 * These are reasonable estimates based on contract complexity.
 * Adjust as needed based on actual gas usage.
 *
 * @example
 * ```typescript
 * gas: PREDICTION_MARKET_GAS_LIMITS.CREATE_MARKET
 * ```
 */
export const PREDICTION_MARKET_GAS_LIMITS = {
  /** Gas limit for creating a new market (includes USDC transfer) */
  CREATE_MARKET: 500000n,

  /** Gas limit for resolving a market */
  RESOLVE_MARKET: 200000n,

  /** Gas limit for processing a bet from Wormhole */
  PROCESS_BET: 150000n,

  /** Gas limit for processing claim authorization from Wormhole */
  PROCESS_CLAIM_AUTHORIZATION: 250000n,

  /** Gas limit for USDC approve operation */
  APPROVE_USDC: 100000n,
} as const;

/**
 * Query pagination defaults
 *
 * Used for paginated queries like getActiveMarkets and getMarketsByOwner
 *
 * @example
 * ```typescript
 * const markets = await contract.read.getActiveMarkets([
 *   PREDICTION_MARKET_PAGINATION.DEFAULT_OFFSET,
 *   PREDICTION_MARKET_PAGINATION.DEFAULT_LIMIT
 * ]);
 * ```
 */
export const PREDICTION_MARKET_PAGINATION = {
  /** Default starting index for pagination */
  DEFAULT_OFFSET: 0n,

  /** Default number of items to fetch per page */
  DEFAULT_LIMIT: 100n,

  /** Maximum allowed limit per query (to prevent gas issues) */
  MAX_LIMIT: 1000n,
} as const;

/**
 * Event names emitted by the contract
 *
 * Use these constants when listening for contract events
 *
 * @example
 * ```typescript
 * contract.on(PREDICTION_MARKET_EVENTS.MARKET_CREATED, (marketId, owner, question) => {
 *   console.log(`Market ${marketId} created by ${owner}`);
 * });
 * ```
 */
export const PREDICTION_MARKET_EVENTS = {
  MARKET_CREATED: 'MarketCreated',
  MARKET_RESOLVED: 'MarketResolved',
  BET_PROCESSED: 'BetProcessed',
  CLAIM_PROCESSED: 'ClaimProcessed',
  OWNERSHIP_TRANSFERRED: 'OwnershipTransferred',
} as const;

/**
 * Type for event names
 */
export type PredictionMarketEventName = typeof PREDICTION_MARKET_EVENTS[keyof typeof PREDICTION_MARKET_EVENTS];

/**
 * Error names that can be thrown by the contract
 *
 * Use these for error handling and user-friendly error messages
 *
 * @example
 * ```typescript
 * try {
 *   await contract.write.createMarket([...args]);
 * } catch (error) {
 *   if (error.message.includes(PREDICTION_MARKET_ERRORS.MARKET_ALREADY_EXISTS)) {
 *     showError('This market already exists');
 *   }
 * }
 * ```
 */
export const PREDICTION_MARKET_ERRORS = {
  BET_ALREADY_PROCESSED: 'BetAlreadyProcessed',
  CHAIN_ID_MISMATCH: 'ChainIdMismatch',
  DEADLINE_EXPIRED: 'DeadlineExpired',
  INVALID_EXPIRES_AT: 'InvalidExpiresAt',
  INVALID_FINALITY: 'InvalidFinality',
  MARKET_ALREADY_CLOSED: 'MarketAlreadyClosed',
  MARKET_ALREADY_EXISTS: 'MarketAlreadyExists',
  MARKET_ALREADY_RESOLVED: 'MarketAlreadyResolved',
  MARKET_EXPIRED: 'MarketExpired',
  MARKET_NOT_EXPIRED: 'MarketNotExpired',
  MARKET_NOT_FOUND: 'MarketNotFound',
  MARKET_NOT_RESOLVED: 'MarketNotResolved',
  NO_WINNING_BETS: 'NoWinningBets',
  NULLIFIER_ALREADY_CONSUMED: 'NullifierAlreadyConsumed',
  OWNABLE_INVALID_OWNER: 'OwnableInvalidOwner',
  OWNABLE_UNAUTHORIZED_ACCOUNT: 'OwnableUnauthorizedAccount',
  REENTRANCY_GUARD_REENTRANT_CALL: 'ReentrancyGuardReentrantCall',
  ZERO_AMOUNT: 'ZeroAmount',
  ZERO_RECIPIENT: 'ZeroRecipient',
  ZERO_TOTAL_POOL: 'ZeroTotalPool',
  ZERO_TREASURY_ADDRESS: 'ZeroTreasuryAddress',
  ZERO_WORMHOLE_ADDRESS: 'ZeroWormholeAddress',
} as const;

/**
 * Type for error names
 */
export type PredictionMarketErrorName = typeof PREDICTION_MARKET_ERRORS[keyof typeof PREDICTION_MARKET_ERRORS];
