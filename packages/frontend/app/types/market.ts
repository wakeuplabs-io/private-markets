export type MarketStatus = 'open' | 'closed' | 'resolved'

export type MarketOption = 'yes' | 'no'

export interface Market {
  id: string
  question: string
  description?: string
  imageUrl?: string
  chancePercentage?: number
  options: {
    yes: string
    no: string
  }
  status: MarketStatus
  createdAt: Date
  closingDate: Date
  resolvedAt?: Date
  winningOption?: MarketOption
  marketId: string
  disclaimer?: string
  // Admin info
  createdBy?: string
  // Resolution info
  merkleRoot?: string
  arbitrumTxHash?: string
}

export interface MarketSummary {
  id: string
  question: string
  status: MarketStatus
  closingDate: Date
  winningOption?: MarketOption
}

export interface CreateMarketData {
  question: string
  optionYes: string
  optionNo: string
  closingDate: Date
  disclaimer?: string
}