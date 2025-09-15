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