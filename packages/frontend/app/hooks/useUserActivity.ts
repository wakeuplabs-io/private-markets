'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { useAccount } from 'wagmi'
import { MarketService, type ContractMarket } from '@/services/marketService'
import { UserBet, UserActivityData, BlockchainConnectionStatus, MarketStatus, MarketOption } from '@/types'
import { vaultService } from '@/services/vault'

interface UseUserActivityReturn {
  activityData: UserActivityData | null
  isLoading: boolean
  error: string | null
  connectionStatus: BlockchainConnectionStatus
  refreshActivity: () => Promise<void>
  claimReward: (betId: string, marketId: string, recipientAddress: string) => Promise<void>
}

/**
 * Convert ContractMarket to a status string
 */
function getMarketStatus(contractMarket: ContractMarket): MarketStatus {
  if (contractMarket.resolved) {
    return 'resolved'
  }
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (contractMarket.expiresAt <= now) {
    return 'finalized'
  }
  return 'open'
}

const fetchUserActivity = async (): Promise<UserActivityData> => {
  try {
    // Get user bets from Aztec (BetVault)
    const userBets = await vaultService.getUserBets();

    // Get unique market IDs
    const uniqueMarketIds = [...new Set(userBets.map(bet => String(bet.marketId)))];

    // Fetch market data from Arbitrum (PredictionMarketCore)
    const marketsResults = await Promise.allSettled(
      uniqueMarketIds.map(id => MarketService.getMarket(Number(id)))
    );

    // Create a map of successful market fetches
    const marketsMap = new Map<string, ContractMarket>();

    marketsResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const marketId = uniqueMarketIds[index];
        marketsMap.set(marketId, result.value);
      } else if (result.status === 'rejected') {
        console.warn(`[useUserActivity] Failed to fetch market ${uniqueMarketIds[index]}:`, result.reason);
      }
    });

    // Transform bets with market information
    const userBetsWithMarketInfo: UserBet[] = userBets
      .filter(bet => {
        const betMarketId = String(bet.marketId);
        const hasMarket = marketsMap.has(betMarketId);
        if (!hasMarket) {
          console.warn(`[useUserActivity] Bet ${bet.id} has no matching market (marketId: ${bet.marketId})`);
        }
        return hasMarket;
      })
      .map(bet => {
        const betMarketId = String(bet.marketId);
        const contractMarket = marketsMap.get(betMarketId)!;

        // Get market status
        const marketStatus = getMarketStatus(contractMarket);
        console.log("marketStatus", marketStatus);
        // Determine winning option
        const winningOption: MarketOption | undefined = contractMarket.resolved
          ? (contractMarket.winningOutcome ? 'yes' : 'no')
          : undefined;

        // Determine if bet is winning
        const isWinning = contractMarket.resolved && winningOption === bet.option;

        // Determine if bet is claimable
        const isClaimable = contractMarket.resolved &&
                           isWinning &&
                           bet.status !== 'claimed';

        // Calculate potential reward using pari-mutuel formula
        // payout = (betAmount * totalPool) / winningTotal
        let potentialReward = 0;
        if (isWinning && contractMarket.resolved) {
          const totalPool = Number(contractMarket.totalPool) / 1e18; // Convert from wei
          const winningTotal = contractMarket.winningOutcome
            ? Number(contractMarket.yesTotal) / 1e18
            : Number(contractMarket.noTotal) / 1e18;

          if (winningTotal > 0) {
            potentialReward = (bet.amount * totalPool) / winningTotal;
          }
        }

        // Return properly typed UserBet
        const userBet: UserBet = {
          id: bet.id,
          marketId: betMarketId,
          marketQuestion: contractMarket.question,
          option: bet.option,
          amount: bet.amount,
          status: bet.status,
          placedAt: bet.placedAt,
          txHash: bet.txHash,
          claimTxHash: bet.claimTxHash,
          claimedAt: bet.claimedAt,
          marketStatus,
          marketWinningOption: winningOption,
          marketResolvedAt: contractMarket.resolved
            ? new Date(Number(contractMarket.expiresAt) * 1000)
            : undefined,
          isWinning,
          isClaimable,
          potentialReward
        };

        return userBet;
      });

    // Calculate totals
    const totalWon = userBetsWithMarketInfo
      .filter(bet => bet.isWinning && bet.status === 'claimed')
      .reduce((sum, bet) => sum + (bet.potentialReward || 0), 0);

    const totalLost = userBetsWithMarketInfo
      .filter(bet => !bet.isWinning && bet.marketStatus === 'resolved')
      .reduce((sum, bet) => sum + bet.amount, 0);

    const totalClaimable = userBetsWithMarketInfo
      .filter(bet => bet.isClaimable)
      .reduce((sum, bet) => sum + (bet.potentialReward || 0), 0);

    const totalClaimed = userBetsWithMarketInfo
      .filter(bet => bet.status === 'claimed')
      .reduce((sum, bet) => sum + (bet.potentialReward || 0), 0);

    return {
      bets: userBetsWithMarketInfo,
      totalBets: userBetsWithMarketInfo.length,
      totalWon,
      totalLost,
      totalClaimable,
      totalClaimed
    }
  } catch (error) {
    // If wallet is not connected, return empty activity data instead of throwing
    if (error instanceof Error && error.message.includes('Wallet must be connected')) {
      console.warn('[useUserActivity] Wallet not connected, returning empty data');
      return {
        bets: [],
        totalBets: 0,
        totalWon: 0,
        totalLost: 0,
        totalClaimable: 0,
        totalClaimed: 0
      }
    }
    // Re-throw other errors
    throw error
  }
}

export function useUserActivity(): UseUserActivityReturn {
  const [connectionStatus, setConnectionStatus] = useState<BlockchainConnectionStatus>('connecting')
  const { isConnected } = useAccount()

  const { data: activityData, error, isLoading, mutate } = useSWR(
    isConnected ? 'user-activity' : null, // Only fetch when connected
    fetchUserActivity,
    {
      refreshInterval: 60000, // Auto-refresh every 10 seconds
      revalidateOnFocus: true, // Revalidate when window gains focus
      revalidateOnReconnect: true, // Revalidate when network reconnects
      dedupingInterval: 5000, // Prevent duplicate requests within 5 seconds
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

  const claimReward = useCallback(async (betId: string, marketId: string, recipientAddress: string) => {
    try {
      await MarketService.claimReward(betId, marketId, recipientAddress)
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
