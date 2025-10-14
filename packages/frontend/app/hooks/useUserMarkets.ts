'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useAccount } from 'wagmi'
import { MarketService } from '@/services/marketService'
import { Market, BlockchainConnectionStatus } from '@/types'

/**
 * Hook to fetch active markets for the markets grid/voting page
 *
 * Note: Despite the name, this hook fetches ALL active markets (not user-specific).
 * It's used to populate the markets grid where users can place bets.
 *
 * Returns only `activeMarkets` - markets that are currently open for betting.
 * Does NOT return user's created markets or user's bets.
 */
interface UseUserMarketsReturn {
  activeMarkets: Market[]
  isLoading: boolean
  error: string | null
  connectionStatus: BlockchainConnectionStatus
}

const fetchUserMarkets = async (): Promise<{ activeMarkets: Market[], connectionStatus: BlockchainConnectionStatus }> => {
  try {
    const blockchainStatus = await MarketService.getConnectionStatus()
    const openMarkets = await MarketService.getActiveMarkets()

    return {
      activeMarkets: openMarkets,
      connectionStatus: blockchainStatus
    }
  } catch (error) {
    console.error('Error loading user markets:', error)
    return {
      activeMarkets: [],
      connectionStatus: 'error'
    }
  }
}

export function useUserMarkets(): UseUserMarketsReturn {
  const [connectionStatus, setConnectionStatus] = useState<BlockchainConnectionStatus>('connecting')
  const { isConnected, address } = useAccount()

  const { data: marketsData, error, isLoading } = useSWR(
    isConnected && address ? ['user-markets', address] : null,
    () => fetchUserMarkets(),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      errorRetryCount: 3,
      onError: (err) => {
        console.error('Error loading user markets:', err)
        setConnectionStatus('error')
      },
      onSuccess: (data) => {
        setConnectionStatus(data.connectionStatus)
      }
    }
  )

  const errorMessage = error ? 
    (error instanceof Error ? error.message : 'Failed to load markets') :
    (!isConnected ? 'Please connect your wallet to view markets' : null)

  return {
    activeMarkets: marketsData?.activeMarkets || [],
    isLoading,
    error: errorMessage,
    connectionStatus
  }
}