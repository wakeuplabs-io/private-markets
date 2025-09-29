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