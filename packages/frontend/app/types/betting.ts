import { MarketOption } from './market'

export type BetStatus = 'pending' | 'confirmed' | 'failed' | 'won' | 'lost' | 'claimable' | 'claimed'

export interface Bet {
  id: string
  marketId: string
  option: MarketOption
  amount: number
  status: BetStatus
  placedAt: Date
  txHash?: string
  // Private bet info (encrypted/hidden)
  userAddress?: string
  // Claiming info
  claimTxHash?: string
  claimedAt?: Date
}

export interface PlaceBetData {
  marketId: string
  option: MarketOption
  amount: number
}

export interface BetConfirmation {
  marketId: string
  option: MarketOption
  amount: number
  question: string
  optionText: string
  closingDate: Date
}

export interface ClaimReward {
  betId: string
  marketId: string
  amount: number
  proof?: unknown // ZK proof for claiming
}

// User Activity types for My Activity view
export interface UserBet {
  id: string
  marketId: string
  marketQuestion: string
  option: MarketOption
  amount: number
  status: BetStatus
  placedAt: Date
  txHash?: string
  claimTxHash?: string
  claimedAt?: Date
  // Market info for display
  marketStatus: 'open' | 'finalized' | 'resolved'
  marketWinningOption?: MarketOption | null
  marketResolvedAt?: Date | null
  // Calculated fields
  isWinning: boolean
  isClaimable: boolean
  potentialReward?: number
}

export interface UserActivityData {
  bets: UserBet[]
  totalBets: number
  totalWon: number
  totalLost: number
  totalClaimable: number
  totalClaimed: number
}