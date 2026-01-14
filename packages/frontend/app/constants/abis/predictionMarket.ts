/**
 * PredictionMarketCore Contract ABI
 *
 * Source: packages/evm/out/PredictionMarketCore.sol/PredictionMarketCore.json
 *
 * This ABI defines the interface for interacting with the PredictionMarketCore
 * smart contract deployed on Arbitrum Sepolia.
 *
 * Key functions:
 * - createMarket: Create a new prediction market
 * - resolveMarket: Resolve a market with winning outcome
 * - processBet: Process a bet from Aztec via Wormhole
 * - processClaimAuthorization: Process claim authorization from Aztec
 * - getMarket: Get market details
 * - getActiveMarkets: Get all active markets
 * - getMarketsByOwner: Get markets created by an owner
 */
export const PREDICTION_MARKET_ABI = [
  {
    "type": "constructor",
    "inputs": [
      { "name": "chainId_", "type": "uint16", "internalType": "uint16" },
      { "name": "evmChainId_", "type": "uint256", "internalType": "uint256" },
      { "name": "finality_", "type": "uint8", "internalType": "uint8" },
      { "name": "treasuryContractAddr", "type": "address", "internalType": "address" }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "chainId",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint16", "internalType": "uint16" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createMarket",
    "inputs": [
      { "name": "question", "type": "string", "internalType": "string" },
      { "name": "totalPool", "type": "uint256", "internalType": "uint256" },
      { "name": "expiresAt", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "marketId", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "evmChainId",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "finality",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint8", "internalType": "uint8" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getActiveMarkets",
    "inputs": [
      { "name": "offset", "type": "uint256", "internalType": "uint256" },
      { "name": "limit", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "marketIds", "type": "uint256[]", "internalType": "uint256[]" },
      {
        "name": "marketResults",
        "type": "tuple[]",
        "internalType": "struct PredictionMarketState.Market[]",
        "components": [
          { "name": "owner", "type": "address", "internalType": "address" },
          { "name": "question", "type": "string", "internalType": "string" },
          { "name": "totalPool", "type": "uint256", "internalType": "uint256" },
          { "name": "yesTotal", "type": "uint256", "internalType": "uint256" },
          { "name": "noTotal", "type": "uint256", "internalType": "uint256" },
          { "name": "resolved", "type": "bool", "internalType": "bool" },
          { "name": "winningOutcome", "type": "bool", "internalType": "bool" },
          { "name": "createdAt", "type": "uint256", "internalType": "uint256" },
          { "name": "expiresAt", "type": "uint256", "internalType": "uint256" }
        ]
      },
      { "name": "total", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAllMarketsCount",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMarket",
    "inputs": [{ "name": "marketId", "type": "uint256", "internalType": "uint256" }],
    "outputs": [
      { "name": "owner", "type": "address", "internalType": "address" },
      { "name": "question", "type": "string", "internalType": "string" },
      { "name": "totalPool", "type": "uint256", "internalType": "uint256" },
      { "name": "yesTotal", "type": "uint256", "internalType": "uint256" },
      { "name": "noTotal", "type": "uint256", "internalType": "uint256" },
      { "name": "resolved", "type": "bool", "internalType": "bool" },
      { "name": "winningOutcome", "type": "bool", "internalType": "bool" },
      { "name": "createdAt", "type": "uint256", "internalType": "uint256" },
      { "name": "expiresAt", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMarketTotals",
    "inputs": [{ "name": "marketId", "type": "uint256", "internalType": "uint256" }],
    "outputs": [
      { "name": "yesTotal", "type": "uint256", "internalType": "uint256" },
      { "name": "noTotal", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMarketsByOwner",
    "inputs": [
      { "name": "owner", "type": "address", "internalType": "address" },
      { "name": "offset", "type": "uint256", "internalType": "uint256" },
      { "name": "limit", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [
      { "name": "marketIds", "type": "uint256[]", "internalType": "uint256[]" },
      {
        "name": "marketResults",
        "type": "tuple[]",
        "internalType": "struct PredictionMarketState.Market[]",
        "components": [
          { "name": "owner", "type": "address", "internalType": "address" },
          { "name": "question", "type": "string", "internalType": "string" },
          { "name": "totalPool", "type": "uint256", "internalType": "uint256" },
          { "name": "yesTotal", "type": "uint256", "internalType": "uint256" },
          { "name": "noTotal", "type": "uint256", "internalType": "uint256" },
          { "name": "resolved", "type": "bool", "internalType": "bool" },
          { "name": "winningOutcome", "type": "bool", "internalType": "bool" },
          { "name": "createdAt", "type": "uint256", "internalType": "uint256" },
          { "name": "expiresAt", "type": "uint256", "internalType": "uint256" }
        ]
      },
      { "name": "total", "type": "uint256", "internalType": "uint256" }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getOwnerMarketCount",
    "inputs": [{ "name": "owner", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isFork",
    "inputs": [],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isNullifierConsumed",
    "inputs": [
      { "name": "marketId", "type": "uint256", "internalType": "uint256" },
      { "name": "nullifier", "type": "bytes32", "internalType": "bytes32" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isProcessed",
    "inputs": [{ "name": "betId", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "processBet",
    "inputs": [
      { "name": "marketId", "type": "uint256", "internalType": "uint256" },
      { "name": "betId", "type": "bytes32", "internalType": "bytes32" },
      { "name": "outcome", "type": "bool", "internalType": "bool" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "processClaimAuthorization",
    "inputs": [
      { "name": "marketId", "type": "uint256", "internalType": "uint256" },
      { "name": "nullifier", "type": "bytes32", "internalType": "bytes32" },
      { "name": "betAmount", "type": "uint256", "internalType": "uint256" },
      { "name": "recipient", "type": "address", "internalType": "address" },
      { "name": "", "type": "uint256", "internalType": "uint256" },
      { "name": "deadline", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "resolveMarket",
    "inputs": [
      { "name": "marketId", "type": "uint256", "internalType": "uint256" },
      { "name": "winningOutcome", "type": "bool", "internalType": "bool" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [{ "name": "newOwner", "type": "address", "internalType": "address" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "treasuryContract",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract ITreasury" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "wormhole",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address", "internalType": "contract IWormhole" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "BetProcessed",
    "inputs": [
      { "name": "marketId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "betId", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "outcome", "type": "bool", "indexed": false, "internalType": "bool" },
      { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ClaimProcessed",
    "inputs": [
      { "name": "marketId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "nullifier", "type": "bytes32", "indexed": true, "internalType": "bytes32" },
      { "name": "recipient", "type": "address", "indexed": false, "internalType": "address" },
      { "name": "payout", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MarketCreated",
    "inputs": [
      { "name": "marketId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "owner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "question", "type": "string", "indexed": false, "internalType": "string" },
      { "name": "totalPool", "type": "uint256", "indexed": false, "internalType": "uint256" },
      { "name": "expiresAt", "type": "uint256", "indexed": false, "internalType": "uint256" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MarketResolved",
    "inputs": [
      { "name": "marketId", "type": "uint256", "indexed": true, "internalType": "uint256" },
      { "name": "winningOutcome", "type": "bool", "indexed": false, "internalType": "bool" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      { "name": "previousOwner", "type": "address", "indexed": true, "internalType": "address" },
      { "name": "newOwner", "type": "address", "indexed": true, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BetAlreadyProcessed",
    "inputs": [{ "name": "betId", "type": "bytes32", "internalType": "bytes32" }]
  },
  {
    "type": "error",
    "name": "ChainIdMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DeadlineExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidExpiresAt",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidFinality",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MarketAlreadyClosed",
    "inputs": [{ "name": "marketId", "type": "uint256", "internalType": "uint256" }]
  },
  {
    "type": "error",
    "name": "MarketAlreadyExists",
    "inputs": [{ "name": "marketId", "type": "uint256", "internalType": "uint256" }]
  },
  {
    "type": "error",
    "name": "MarketAlreadyResolved",
    "inputs": [{ "name": "marketId", "type": "uint256", "internalType": "uint256" }]
  },
  {
    "type": "error",
    "name": "MarketExpired",
    "inputs": [{ "name": "marketId", "type": "uint256", "internalType": "uint256" }]
  },
  {
    "type": "error",
    "name": "MarketNotExpired",
    "inputs": [{ "name": "marketId", "type": "uint256", "internalType": "uint256" }]
  },
  {
    "type": "error",
    "name": "MarketNotFound",
    "inputs": [{ "name": "marketId", "type": "uint256", "internalType": "uint256" }]
  },
  {
    "type": "error",
    "name": "MarketNotResolved",
    "inputs": [{ "name": "marketId", "type": "uint256", "internalType": "uint256" }]
  },
  {
    "type": "error",
    "name": "NoWinningBets",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NullifierAlreadyConsumed",
    "inputs": [{ "name": "nullifier", "type": "bytes32", "internalType": "bytes32" }]
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [{ "name": "owner", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroRecipient",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroTotalPool",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroTreasuryAddress",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroWormholeAddress",
    "inputs": []
  }
] as const;

/**
 * Type export for PredictionMarketCore ABI
 * Use this for type-safe contract interactions
 */
export type PredictionMarketABI = typeof PREDICTION_MARKET_ABI;
