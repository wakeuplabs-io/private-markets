'use client'

import useSWR from 'swr'
import { MarketBetsService } from '@/services/market'
import { ProcessedBet, ProcessedBetStats } from '@/types'

/**
 * Hook to fetch processed bets for a specific market
 *
 * Fetches BetProcessed events from the PredictionMarketCore contract
 * and calculates statistics from the bet data.
 *
 * @param marketId - The market ID to fetch bets for (null to disable fetching)
 * @returns Object with bets array, stats, loading state, error, and refetch function
 */
interface UseMarketBetsReturn {
  bets: ProcessedBet[]
  stats: ProcessedBetStats | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

const fetchMarketBets = async (marketId: string): Promise<{ bets: ProcessedBet[], stats: ProcessedBetStats }> => {
  const bets = await MarketBetsService.getMarketBets(marketId)
  const stats = MarketBetsService.calculateBetStats(bets)
  return { bets, stats }
}

export function useMarketBets(marketId: string | null): UseMarketBetsReturn {
  const { data, error, isLoading, mutate } = useSWR(
    marketId ? `market-bets-${marketId}` : null,
    () => fetchMarketBets(marketId!),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // 30 seconds between duplicate requests
      errorRetryCount: 2,
      onError: (err) => {
        console.error('[useMarketBets] Error fetching bets:', err)
      },
    }
  )

  return {
    bets: data?.bets ?? [],
    stats: data?.stats ?? null,
    isLoading,
    error: error ?? null,
    refetch: () => mutate(),
  }
}

/**
 * Pre-fetch market bets for a given market ID
 * Useful for prefetching on hover to improve UX
 *
 * @param marketId - The market ID to prefetch bets for
 */
export function prefetchMarketBets(marketId: string): void {
  // Fire and forget - just populate the cache
  MarketBetsService.getMarketBets(marketId).catch((err) => {
    console.warn('[prefetchMarketBets] Failed to prefetch:', err)
  })
}
