'use client'

import { useState } from 'react'
import { PlaceBetData, Bet, BetStatus } from '@/types'

interface UseBettingReturn {
  bets: Bet[]
  isPlacingBet: boolean
  isClaiming: boolean
  error: string | null
  placeBet: (data: PlaceBetData) => Promise<void>
  claimReward: (betId: string) => Promise<void>
  getBetsByMarket: (marketId: string) => Bet[]
  clearError: () => void
}

const apiPlaceBet = async (data: PlaceBetData): Promise<Bet> => {
  await new Promise(resolve => setTimeout(resolve, 2000))

  const bet: Bet = {
    id: Date.now().toString(),
    marketId: data.marketId,
    option: data.option,
    amount: data.amount,
    status: 'confirmed',
    placedAt: new Date(),
    txHash: `0x${Math.random().toString(16).substr(2, 64)}`
  }

  return bet
}

const apiClaimReward = async (betId: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 3000))
}

export function useBetting(): UseBettingReturn {
  const [bets, setBets] = useState<Bet[]>([])
  const [isPlacingBet, setIsPlacingBet] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const placeBet = async (data: PlaceBetData) => {
    try {
      setIsPlacingBet(true)
      setError(null)

      const newBet = await apiPlaceBet(data)
      setBets(prev => [newBet, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bet')
      throw err
    } finally {
      setIsPlacingBet(false)
    }
  }

  const claimReward = async (betId: string) => {
    try {
      setIsClaiming(true)
      setError(null)

      await apiClaimReward(betId)

      setBets(prev =>
        prev.map(bet =>
          bet.id === betId
            ? {
                ...bet,
                status: 'claimed' as BetStatus,
                claimedAt: new Date(),
                claimTxHash: `0x${Math.random().toString(16).substr(2, 64)}`
              }
            : bet
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim reward')
      throw err
    } finally {
      setIsClaiming(false)
    }
  }

  const getBetsByMarket = (marketId: string) => {
    return bets.filter(bet => bet.marketId === marketId)
  }

  const clearError = () => {
    setError(null)
  }

  return {
    bets,
    isPlacingBet,
    isClaiming,
    error,
    placeBet,
    claimReward,
    getBetsByMarket,
    clearError
  }
}