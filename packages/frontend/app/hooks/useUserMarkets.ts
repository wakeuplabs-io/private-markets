'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { MarketService } from '@/services/marketService'
import { Market } from '@/types'

interface UseUserMarketsReturn {
  markets: Market[]
  activeMarkets: Market[]
  isLoading: boolean
  error: string | null
  refreshMarkets: () => Promise<void>
}

export function useUserMarkets(): UseUserMarketsReturn {
  const [markets, setMarkets] = useState<Market[]>([])
  const [activeMarkets, setActiveMarkets] = useState<Market[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isConnected } = useAccount()

  const loadMarkets = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (!isConnected) {
        setError('Please connect your wallet to view markets')
        return
      }

      if (!MarketService.isValidContractAddress()) {
        setError('Contract address not configured')
        return
      }

      const [allMarkets, openMarkets] = await Promise.all([
        MarketService.getUserMarkets(),
        MarketService.getActiveMarkets()
      ])

      setMarkets(allMarkets)
      setActiveMarkets(openMarkets)
    } catch (err) {
      console.error('Error loading user markets:', err)
      setError(err instanceof Error ? err.message : 'Failed to load markets')
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

  return {
    markets,
    activeMarkets,
    isLoading,
    error,
    refreshMarkets
  }
}