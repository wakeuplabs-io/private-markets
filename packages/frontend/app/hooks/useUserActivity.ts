'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { MarketService } from '@/services/marketService'
import { UserBet, UserActivityData, BetStatus, BlockchainConnectionStatus } from '@/types'

interface UseUserActivityReturn {
  activityData: UserActivityData | null
  isLoading: boolean
  error: string | null
  connectionStatus: BlockchainConnectionStatus
  refreshActivity: () => Promise<void>
  claimReward: (betId: string) => Promise<void>
}

export function useUserActivity(): UseUserActivityReturn {
  const [activityData, setActivityData] = useState<UserActivityData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<BlockchainConnectionStatus>('connecting')
  const { isConnected } = useAccount()

  const loadActivityData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      setConnectionStatus('connecting')

      const blockchainStatus = await MarketService.getConnectionStatus()
      setConnectionStatus(blockchainStatus)

      if (!isConnected) {
        setError('Please connect your wallet to view your activity')
        return
      }

      // Load user bets and markets data
      const [userBets, markets] = await Promise.all([
        MarketService.getUserBets(),
        MarketService.getUserMarkets()
      ])

      const userBetsWithMarketInfo: UserBet[] = userBets.map(bet => {
        const market = markets.find(m => m.id === bet.marketId)
        
        // Calculate if this bet is winning
        const isWinning = market?.status === 'resolved' && 
                         market?.winningOption?.id === bet.option

        // Calculate if this bet is claimable
        const isClaimable = market?.status === 'resolved' && 
                           isWinning && 
                           bet.status !== 'claimed'

        // TODO: Calculate potential reward (simplified - in real app this would use odds)
        const potentialReward = isWinning ? bet.amount * 2 : 0

        return {
            ...bet,
            marketQuestion: market?.question || 'Unknown Market',
            marketStatus: market?.status || 'open',
            marketWinningOption: market?.winningOption?.id as 'yes' | 'no' | null || null,
            marketResolvedAt: market?.resolvedAt || null,
            isWinning,
            isClaimable,
            potentialReward
        }
      })

      const activityData: UserActivityData = {
        bets: userBetsWithMarketInfo,
        totalBets: userBetsWithMarketInfo.length,
        totalWon: 0,
        totalLost: 0,
        totalClaimable: 0,
        totalClaimed: 0
      }

      setActivityData(activityData)
      setError(null)
    } catch (err) {
      console.error('Error loading user activity:', err)
      setError(err instanceof Error ? err.message : 'Failed to load activity data')
      setConnectionStatus('error')
    } finally {
      setIsLoading(false)
    }
  }, [isConnected])

  const refreshActivity = async () => {
    await loadActivityData()
  }

  const claimReward = async (betId: string) => {
    try {
      await MarketService.claimReward(betId)
      await loadActivityData()
    } catch (err) {
      console.error('Error claiming reward:', err)
      throw err
    }
  }

  useEffect(() => {
    loadActivityData()
  }, [loadActivityData])

  // Auto-refresh every 10 seconds when connected
  useEffect(() => {
    if (!isConnected || error) return

    const interval = setInterval(() => {
      loadActivityData()
    }, 10000)

    return () => clearInterval(interval)
  }, [isConnected, error, loadActivityData])

  return {
    activityData,
    isLoading,
    error,
    connectionStatus,
    refreshActivity,
    claimReward
  }
}
