'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { MarketService } from '@/services/marketService'
import { Market, BlockchainConnectionStatus } from '@/types'

interface UseUserMarketsReturn {
  markets: Market[]
  activeMarkets: Market[]
  isLoading: boolean
  error: string | null
  connectionStatus: BlockchainConnectionStatus
  refreshMarkets: () => Promise<void>
}

export function useUserMarkets(): UseUserMarketsReturn {
  const [markets, setMarkets] = useState<Market[]>([])
  const [activeMarkets, setActiveMarkets] = useState<Market[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<BlockchainConnectionStatus>('connecting')
  const { isConnected } = useAccount()

  const loadMarkets = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      setConnectionStatus('connecting')

      // Get blockchain connection status
      const blockchainStatus = await MarketService.getConnectionStatus()
      setConnectionStatus(blockchainStatus)

      if (!isConnected) {
        setError('Please connect your wallet to view markets')
        return
      }

      // Load markets regardless of blockchain status (fallback to mock if offline)
      const [allMarkets, openMarkets] = await Promise.all([
        MarketService.getUserMarkets(),
        MarketService.getActiveMarkets()
      ])

      setMarkets(allMarkets)
      setActiveMarkets(openMarkets)

      // Clear any previous errors if we successfully loaded data
      setError(null)
    } catch (err) {
      console.error('Error loading user markets:', err)
      setError(err instanceof Error ? err.message : 'Failed to load markets')
      setConnectionStatus('error')
    } finally {
      setIsLoading(false)
    }
  }, [isConnected])

  const refreshMarkets = async () => {
    await loadMarkets()
  }

  useEffect(() => {
    loadMarkets()
  }, [loadMarkets])

  // Auto-refresh every 10 seconds when connected
  useEffect(() => {
    if (!isConnected || error) return

    const interval = setInterval(() => {
      loadMarkets()
    }, 10000)

    return () => clearInterval(interval)
  }, [isConnected, error, loadMarkets])

  console.log('markets', markets)
  console.log('activeMarkets', activeMarkets)
  console.log('isLoading', isLoading)
  return {
    markets,
    activeMarkets,
    isLoading,
    error,
    connectionStatus,
    refreshMarkets
  }
}