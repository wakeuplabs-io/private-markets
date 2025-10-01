'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
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

// Fetcher function for SWR
const fetchUserActivity = async (): Promise<UserActivityData> => {
  // Load user bets and markets data
  const [userBets, markets] = await Promise.all([
    MarketService.getUserBets(),
    MarketService.getUserMarkets()
  ])

  // Transform bets into UserBet format with market info
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

  return {
    bets: userBetsWithMarketInfo,
    totalBets: userBetsWithMarketInfo.length,
    totalWon: 0,
    totalLost: 0,
    totalClaimable: 0,
    totalClaimed: 0
  }
}

export function useUserActivity(): UseUserActivityReturn {
  const [connectionStatus, setConnectionStatus] = useState<BlockchainConnectionStatus>('connecting')
  const { isConnected } = useAccount()

  // SWR configuration
  const { data: activityData, error, isLoading, mutate } = useSWR(
    isConnected ? 'user-activity' : null, // Only fetch when connected
    fetchUserActivity,
    {
      refreshInterval: 10000, // Auto-refresh every 10 seconds
      revalidateOnFocus: true, // Revalidate when window gains focus
      revalidateOnReconnect: true, // Revalidate when network reconnects
      onError: (err) => {
        console.error('Error loading user activity:', err)
        setConnectionStatus('error')
      },
      onSuccess: async () => {
        // Update connection status when data loads successfully
        const blockchainStatus = await MarketService.getConnectionStatus()
        setConnectionStatus(blockchainStatus)
      }
    }
  )

  const refreshActivity = useCallback(async () => {
    await mutate()
  }, [mutate])

  const claimReward = useCallback(async (betId: string) => {
    try {
      await MarketService.claimReward(betId)
      // Refresh data after successful claim
      await mutate()
    } catch (err) {
      console.error('Error claiming reward:', err)
      throw err
    }
  }, [mutate])

  // Handle wallet connection errors
  const errorMessage = error ? 
    (error instanceof Error ? error.message : 'Failed to load activity data') :
    (!isConnected ? 'Please connect your wallet to view your activity' : null)

  return {
    activityData: activityData || null,
    isLoading,
    error: errorMessage,
    connectionStatus,
    refreshActivity,
    claimReward
  }
}