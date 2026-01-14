"use client"

import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { evmTokenService } from '@/services/token/EVMTokenService'

interface EVMTokenActionsState {
  isMinting: boolean
  mintError?: string
  lastTxHash?: string
}

export function useEVMTokenActions(tokenAddress?: `0x${string}`) {
  const { address: userAddress, isConnected } = useAccount()
  const [state, setState] = useState<EVMTokenActionsState>({
    isMinting: false,
  })

  const mint = useCallback(async (recipient: `0x${string}`, amount: bigint): Promise<string> => {
    if (!tokenAddress) throw new Error("No token address configured")
    if (!isConnected) throw new Error("EVM wallet not connected")

    setState(prev => ({ ...prev, isMinting: true, mintError: undefined }))

    try {
      const txHash = await evmTokenService.mint(tokenAddress, recipient, amount)
      setState(prev => ({ ...prev, isMinting: false, lastTxHash: txHash }))
      return txHash
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Mint failed"
      setState(prev => ({ ...prev, isMinting: false, mintError: errorMessage }))
      throw error
    }
  }, [tokenAddress, isConnected])

  const clearErrors = useCallback(() => {
    setState(prev => ({ ...prev, mintError: undefined }))
  }, [])

  return {
    mint,
    isMinting: state.isMinting,
    mintError: state.mintError,
    lastTxHash: state.lastTxHash,
    clearErrors,
    isConnected,
    userAddress,
    hasTokenAddress: !!tokenAddress,
  }
}
