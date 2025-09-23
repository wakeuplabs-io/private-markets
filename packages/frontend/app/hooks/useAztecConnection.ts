'use client'

import { useState, useEffect, useCallback } from 'react'
import { aztecService, type AztecConnectionStatus, type AztecConnectionError } from '@/services/aztecService'

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
 */
export function useAztecConnection(): UseAztecConnectionReturn {
  const [status, setStatus] = useState<AztecConnectionStatus>('disconnected')
  const [error, setError] = useState<AztecConnectionError | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  // Update connection status
  const updateStatus = useCallback(() => {
    const currentStatus = aztecService.getStatus()
    const currentError = aztecService.getLastError()
    
    setStatus(currentStatus)
    setError(currentError)
  }, [])

  // Check connection status periodically
  useEffect(() => {
    updateStatus()
    
    const interval = setInterval(() => {
      updateStatus()
    }, 2000) // Check every 2 seconds

    return () => clearInterval(interval)
  }, [updateStatus])

  // Retry connection
  const retry = useCallback(async () => {
    if (isRetrying) return

    setIsRetrying(true)
    try {
      await aztecService.retry()
      updateStatus()
    } catch (error) {
      console.error('Retry failed:', error)
      updateStatus()
    } finally {
      setIsRetrying(false)
    }
  }, [isRetrying, updateStatus])

  // Clear error
  const clearError = useCallback(() => {
    aztecService.clearError()
    updateStatus()
  }, [updateStatus])

  // Computed properties
  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting' || isRetrying
  const canRetry = aztecService.canRetry() && !isRetrying
  const errorMessage = error?.message || null
  const healthInfo = aztecService.getHealthInfo()

  return {
    status,
    isConnected,
    isConnecting,
    error,
    errorMessage,
    canRetry,
    retry,
    clearError,
    healthInfo
  }
}

/**
 * Hook simplificado para verificar si Aztec está disponible
 */
export function useAztecAvailable(): {
  isAvailable: boolean
  isChecking: boolean
  checkAvailability: () => Promise<boolean>
} {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  
  const checkAvailability = useCallback(async (): Promise<boolean> => {
    setIsChecking(true)
    try {
      const available = await aztecService.isAvailable()
      setIsAvailable(available)
      return available
    } catch {
      setIsAvailable(false)
      return false
    } finally {
      setIsChecking(false)
    }
  }, [])

  useEffect(() => {
    checkAvailability()
  }, [checkAvailability])

  return {
    isAvailable,
    isChecking,
    checkAvailability
  }
}
