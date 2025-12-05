export type MarketStatus = 'open' | 'finalized' | 'resolved'

export type BlockchainConnectionStatus = 'online' | 'offline' | 'connecting' | 'error'

export type MarketOption = 'yes' | 'no'

export interface MarketOptionWithOdds {
  id: string
  name: string
  odds: number
}

// Safe version with explicit nullability for runtime safety
export interface SafeMarketOptionWithOdds {
  id: string | null
  name: string | null
  odds: number | null
}

export interface Market {
  id: string
  question: string
  description?: string | null
  imageUrl?: string | null
  chancePercentage?: number | null
  options: MarketOptionWithOdds[]
  status: MarketStatus
  createdAt: Date
  closingDate?: Date | null
  resolvedAt?: Date | null
  winningOption?: MarketOptionWithOdds | null
  disclaimer?: string | null
  createdBy?: string | null
  merkleRoot?: string | null
  arbitrumTxHash?: string | null
  admin?: string | null
  isOfflineMode?: boolean
}

// Safe runtime version that accepts potentially invalid data
export interface SafeMarket {
  id: string | null
  question: string | null
  description?: string | null
  imageUrl?: string | null
  chancePercentage?: number | null
  options: (MarketOptionWithOdds | null)[] | null
  status: MarketStatus | string | null
  createdAt: Date | string | null
  closingDate?: Date | string | null
  resolvedAt?: Date | string | null
  winningOption?: MarketOptionWithOdds | null
  disclaimer?: string | null
  createdBy?: string | null
  merkleRoot?: string | null
  arbitrumTxHash?: string | null
  admin?: string | null
  isOfflineMode?: boolean | null
}

export interface MarketSummary {
  id: string
  question: string
  status: MarketStatus
  closingDate: Date
  winningOption?: MarketOptionWithOdds | null
}

export interface CreateMarketData {
  question: string
  closingTime: Date
}

export interface AdminMarket extends Market {
  adminActions: {
    canResolve: boolean
    canEdit: boolean
    canDelete: boolean
  }
  bets: {
    total: number
    yesCount: number
    noCount: number
    totalVolume: number
  }
  performance: {
    views: number
    engagement: number
  }
}

// Safe runtime version for AdminMarket
export interface SafeAdminMarket extends SafeMarket {
  adminActions: {
    canResolve: boolean | null
    canEdit: boolean | null
    canDelete: boolean | null
  } | null
  bets: {
    total: number | null
    yesCount: number | null
    noCount: number | null
    totalVolume: number | null
  } | null
  performance: {
    views: number | null
    engagement: number | null
  } | null
}

export interface CreateMarketFormData {
  question: string
  closingTime: Date
}

export interface AdminMarketFilters {
  status?: MarketStatus[]
  dateRange?: {
    from: Date
    to: Date
  }
  sortBy?: 'createdAt' | 'closingDate' | 'volume' | 'engagement'
  sortOrder?: 'asc' | 'desc'
}

export interface MarketResolutionData {
  marketId: string
  winningOption: MarketOption
  evidence?: string
  notes?: string
}

export interface CreateMarketResponse {
  success: boolean
  market: AdminMarket
}

export interface ResolveMarketResponse {
  success: boolean
  marketId: string
  winningOption: MarketOptionWithOdds
}

/**
 * Contract-level market representation (from blockchain)
 *
 * This is the raw data structure returned by the PredictionMarketCore smart contract.
 * All fields use bigint for accurate representation of Solidity uint256 values.
 *
 * This type represents the low-level contract data before transformation into
 * the application-level Market type.
 *
 * @see Market - Application-level market type with transformed data
 */
export interface ContractMarket {
  /** Market ID (from contract storage) */
  id: bigint;

  /** Address of the market creator/owner */
  owner: string;

  /** Market question (e.g., "Will ETH reach $5000 by 2025?") */
  question: string;

  /** Total token pool deposited by market owner (in wei, 18 decimals for MockERC20) */
  totalPool: bigint;

  /** Total amount bet on YES outcome (in wei) */
  yesTotal: bigint;

  /** Total amount bet on NO outcome (in wei) */
  noTotal: bigint;

  /** Whether the market has been resolved */
  resolved: boolean;

  /** Winning outcome (true = YES, false = NO). Only valid if resolved = true */
  winningOutcome: boolean;

  /** Unix timestamp when market was created */
  createdAt: bigint;

  /** Unix timestamp when market expires/closes for betting */
  expiresAt: bigint;
}

/**
 * Admin-specific market data
 *
 * Additional metrics and permissions for market management in the admin dashboard.
 * This extends the basic market data with administrative information.
 */
export interface AdminMarketData {
  /** Total number of bets placed on this market */
  totalBets: number;

  /** Number of bets on YES outcome */
  yesCount: number;

  /** Number of bets on NO outcome */
  noCount: number;

  /** Total volume (yesTotal + noTotal) in wei */
  totalVolume: bigint;

  /** Whether the admin can resolve this market (market expired && not resolved) */
  canResolve: boolean;

  /** Whether the admin can edit this market (market not resolved) */
  canEdit: boolean;
}

/**
 * Market statistics aggregation
 *
 * Used for dashboard analytics and overview displays.
 * Provides high-level metrics across all markets.
 */
export interface MarketStats {
  /** Total number of markets ever created */
  totalMarkets: number;

  /** Number of markets currently open for betting */
  activeMarkets: number;

  /** Number of markets that have expired but not yet resolved */
  finalizedMarkets: number;

  /** Number of markets that have been resolved */
  resolvedMarkets: number;

  /** Total volume across all markets (in wei) */
  totalVolume: bigint;

  /** Average volume per market (in normal units, e.g., ETH) */
  averageVolume: number;
}