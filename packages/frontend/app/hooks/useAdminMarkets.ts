'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { MarketService } from '@/services/marketService'
import { Market, CreateMarketFormData, BlockchainConnectionStatus } from '@/types'

interface UseAdminMarketsReturn {
  markets: Market[]
  isLoading: boolean
  error: string | null
  connectionStatus: BlockchainConnectionStatus
  refreshMarkets: () => Promise<void>
  createMarket: (formData: CreateMarketFormData) => Promise<void>
  resolveMarket: (marketId: string, winningOption: 'yes' | 'no') => Promise<void>
}

export function useAdminMarkets(): UseAdminMarketsReturn {
  const [markets, setMarkets] = useState<Market[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<BlockchainConnectionStatus>('connecting')
  const { isConnected } = useAccount()

  const loadAdminData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      setConnectionStatus('connecting')

      // Get blockchain connection status
      const blockchainStatus = await MarketService.getConnectionStatus()
      setConnectionStatus(blockchainStatus)

      if (!isConnected) {
        setError('Please connect your wallet to view admin data')
        return
      }

      // Load markets regardless of blockchain status (fallback to mock if offline)
      const adminMarkets = await MarketService.getAdminMarkets()
      setMarkets(adminMarkets)

      // Clear any previous errors if we successfully loaded data
      setError(null)
    } catch (err) {
      console.error('Error loading admin data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
      setConnectionStatus('error')
    } finally {
      setIsLoading(false)
    }
  }, [isConnected])

  const refreshMarkets = async () => {
    await loadAdminData()
  }

  const createMarket = async (formData: CreateMarketFormData) => {
    try {
      setError(null)

      const hash = await MarketService.createMarket(formData.question, formData.closingTime)
      console.log('Market creation transaction:', hash)

      // Wait a moment then refresh to get the new market
      setTimeout(() => {
        loadAdminData()
      }, 2000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create market'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const resolveMarket = async (marketId: string, winningOption: 'yes' | 'no') => {
    try {
      setError(null)

      const hash = await MarketService.resolveMarket(Number(marketId), winningOption)
      console.log('Market resolution transaction:', hash)

      // Wait a moment then refresh to get the updated market
      setTimeout(() => {
        loadAdminData()
      }, 2000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve market'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  useEffect(() => {
    loadAdminData()
  }, [loadAdminData])

  // Auto-refresh every 15 seconds when connected
  useEffect(() => {
    if (!isConnected || error) return

    const interval = setInterval(() => {
      loadAdminData()
    }, 15000)

    return () => clearInterval(interval)
  }, [isConnected, error, loadAdminData])

  return {
    markets,
    isLoading,
    error,
    connectionStatus,
    refreshMarkets,
    createMarket,
    resolveMarket
  }
}