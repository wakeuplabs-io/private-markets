'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useAccount } from 'wagmi'
import { MarketService } from '@/services/marketService'
import { Market, BlockchainConnectionStatus } from '@/types'

interface UseUserMarketsReturn {
  markets: Market[]
  activeMarkets: Market[]
  isLoading: boolean
  error: string | null
  connectionStatus: BlockchainConnectionStatus
}

const fetchUserMarkets = async (): Promise<{ markets: Market[], activeMarkets: Market[], connectionStatus: BlockchainConnectionStatus }> => {
  try {
    // Get blockchain connection status
    const blockchainStatus = await MarketService.getConnectionStatus()
    
    // Load markets regardless of blockchain status (fallback to mock if offline)
    const [allMarkets, openMarkets] = await Promise.all([
      MarketService.getUserMarkets(),
      MarketService.getActiveMarkets()
    ])
    
    return {
      markets: allMarkets,
      activeMarkets: openMarkets,
      connectionStatus: blockchainStatus
    }
  } catch (error) {
    console.error('Error loading user markets:', error)
    //throw error
    return {
      markets: [],
      activeMarkets: [],
      connectionStatus: 'error'
    }
  }
}

export function useUserMarkets(): UseUserMarketsReturn {
  const [connectionStatus, setConnectionStatus] = useState<BlockchainConnectionStatus>('connecting')
  const { isConnected } = useAccount()

  const { data: marketsData, error, isLoading } = useSWR(
    isConnected ? 'user-markets' : null, // Only fetch when connected
    fetchUserMarkets,
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
    markets: marketsData?.markets || [],
    activeMarkets: marketsData?.activeMarkets || [],
    isLoading,
    error: errorMessage,
    connectionStatus
  }
}