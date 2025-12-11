'use client'

import { useState, useCallback } from 'react'
import { useWallet } from '@/context'
import { walletRegistry } from '@/lib/wallet/walletRegistry'

// Re-export types for backwards compatibility
export type AztecConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
export interface AztecConnectionError {
  message: string
  code?: string
}

interface UseAztecConnectionReturn {
  status: AztecConnectionStatus
  isConnected: boolean
  isConnecting: boolean
  error: AztecConnectionError | null
  errorMessage: string | null
  canRetry: boolean
  retry: () => Promise<void>
  clearError: () => void
  healthInfo: {
    status: AztecConnectionStatus
    isConnected: boolean
    error: AztecConnectionError | null
    canRetry: boolean
    retryCount: number
    maxRetries: number
  }
}

/**
 * Hook para manejar el estado de conexión con Aztec
 * Proporciona información sobre el estado de conexión y manejo de errores
 *
 * REFACTORED: Now uses WalletContext instead of aztecService
 */
export function useAztecConnection(): UseAztecConnectionReturn {
  const { status, isConnected, isConnecting, error, connectWallet, resetWallet } = useWallet()
  const [isRetrying, setIsRetrying] = useState(false)

  // Convert wallet error string to structured error
  const structuredError: AztecConnectionError | null = error
    ? { message: error }
    : null

  // Retry connection by attempting to reconnect
  const retry = useCallback(async () => {
    if (isRetrying) return

    setIsRetrying(true)
    try {
      // Reset wallet state first
      resetWallet()
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 500))
      // Try to reconnect
      await connectWallet('aztec')
    } catch (error) {
      console.error('Retry failed:', error)
    } finally {
      setIsRetrying(false)
    }
  }, [isRetrying, resetWallet, connectWallet])

  // Clear error by resetting wallet state
  const clearError = useCallback(() => {
    resetWallet()
  }, [resetWallet])

  // Check if retry is possible (can retry if there's an error and not currently retrying)
  const canRetry = status === 'error' && !isRetrying

  // Health info (simplified, no retry count tracking)
  const healthInfo = {
    status: status as AztecConnectionStatus,
    isConnected,
    error: structuredError,
    canRetry,
    retryCount: 0, // Not tracked anymore
    maxRetries: 3, // Static value for UI
  }

  return {
    status: status as AztecConnectionStatus,
    isConnected,
    isConnecting: isConnecting || isRetrying,
    error: structuredError,
    errorMessage: error,
    canRetry,
    retry,
    clearError,
    healthInfo
  }
}

/**
 *
 * REFACTORED: Now checks if Aztec provider is initialized via walletService
 */
export function useAztecAvailable(): {
  isAvailable: boolean
  isChecking: boolean
  checkAvailability: () => Promise<boolean>
} {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const { isInitializingProvider } = useWallet()

  const checkAvailability = useCallback(async (): Promise<boolean> => {
    setIsChecking(true)
    try {
      // Check if Aztec provider is registered
      const provider = walletRegistry.get('aztec')
      const available = provider !== null
      setIsAvailable(available)
      return available
    } catch {
      setIsAvailable(false)
      return false
    } finally {
      setIsChecking(false)
    }
  }, [])

  return {
    isAvailable: isAvailable && !isInitializingProvider,
    isChecking: isChecking || isInitializingProvider,
    checkAvailability
  }
}
