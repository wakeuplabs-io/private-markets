export type MarketStatus = 'open' | 'finalized' | 'resolved'

export type MarketOption = 'yes' | 'no'

export interface MarketOptionWithOdds {
  id: string
  name: string
  odds: number
}

export interface Market {
  id: string
  question: string
  description?: string
  imageUrl?: string
  chancePercentage?: number
  options: MarketOptionWithOdds[]
  status: MarketStatus
  createdAt: Date
  closingDate?: Date
  resolvedAt?: Date | null
  winningOption?: MarketOptionWithOdds | null
  disclaimer?: string
  createdBy?: string
  merkleRoot?: string
  arbitrumTxHash?: string
  admin?: string
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