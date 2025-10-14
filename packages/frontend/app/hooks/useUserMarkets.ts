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

const fetchUserMarkets = async (userAddress: string | undefined): Promise<{ markets: Market[], activeMarkets: Market[], connectionStatus: BlockchainConnectionStatus }> => {
  try {
    const blockchainStatus = await MarketService.getConnectionStatus()
    
    const [allMarkets, openMarkets] = await Promise.all([
      userAddress ? MarketService.getUserMarkets(userAddress) : Promise.resolve([]),
      MarketService.getActiveMarkets()
    ])
    
    return {
      markets: allMarkets,
      activeMarkets: openMarkets,
      connectionStatus: blockchainStatus
    }
  } catch (error) {
    console.error('Error loading user markets:', error)
    return {
      markets: [],
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
    () => fetchUserMarkets(address),
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