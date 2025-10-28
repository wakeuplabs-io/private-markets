"use client"

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { evmTokenService, type EVMTokenInfo } from '@/services/token/EVMTokenService'

/**
 * Hook result interface
 */
export interface UseEVMTokenBalanceResult {
  tokenInfo?: EVMTokenInfo
  balance?: bigint
  isLoading: boolean
  error?: string
  refetch: () => Promise<void>
}

/**
 * useEVMTokenBalance Hook
 *
 * Fetches and manages ERC20 token balance for the connected EVM wallet.
 * Automatically refetches when the account changes or when manually triggered.
 *
 */
export function useEVMTokenBalance(tokenAddress?: `0x${string}`): UseEVMTokenBalanceResult {
  const { address: userAddress, isConnected } = useAccount()

  const [tokenInfo, setTokenInfo] = useState<EVMTokenInfo | undefined>(undefined)
  const [balance, setBalance] = useState<bigint | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | undefined>(undefined)

  /**
   * Fetch token info and balance
   */
  const fetchData = async () => {
    // Reset state if not connected or no token address
    if (!isConnected || !userAddress || !tokenAddress) {
      setTokenInfo(undefined)
      setBalance(undefined)
      setError(undefined)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(undefined)

    try {
      // Fetch token info and balance in parallel
      const [info, bal] = await Promise.all([
        evmTokenService.getTokenInfo(tokenAddress),
        evmTokenService.getBalance(tokenAddress, userAddress)
      ])

      setTokenInfo(info)
      setBalance(bal)
    } catch (err) {
      console.error('Failed to fetch EVM token balance:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch token data')
      setTokenInfo(undefined)
      setBalance(undefined)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Fetch data on mount and when dependencies change
   */
  useEffect(() => {
    fetchData()
  }, [userAddress, isConnected, tokenAddress])

  /**
   * Manual refetch function
   */
  const refetch = async () => {
    await fetchData()
  }

  return {
    tokenInfo,
    balance,
    isLoading,
    error,
    refetch
  }
}

export function useUSDCBalance(): UseEVMTokenBalanceResult {
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined

  if (!usdcAddress) {
    console.warn('USDC address not configured in environment variables')
  }

  return useEVMTokenBalance(usdcAddress)
}
