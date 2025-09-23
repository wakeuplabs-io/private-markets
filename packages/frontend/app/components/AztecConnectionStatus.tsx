'use client'

import React from 'react'
import { useAztecConnection } from '@/hooks/useAztecConnection'
import { Button } from '@/components/ui/Button'

interface AztecConnectionStatusProps {
  showWhenConnected?: boolean
  className?: string
}

export function AztecConnectionStatus({ 
  showWhenConnected = false, 
  className = '' 
}: AztecConnectionStatusProps) {
  const { 
    status, 
    isConnected, 
    isConnecting, 
    errorMessage, 
    canRetry, 
    retry, 
    clearError 
  } = useAztecConnection()

  // Don't show anything if connected and showWhenConnected is false
  if (isConnected && !showWhenConnected) {
    return null
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-50 border-green-200 text-green-800'
      case 'connecting':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800'
      default:
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return '✅'
      case 'connecting':
        return '🔄'
      case 'error':
        return '❌'
      default:
        return '⚠️'
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'connected':
        return 'Conectado a Aztec'
      case 'connecting':
        return isConnecting ? 'Conectando a Aztec...' : 'Estableciendo conexión...'
      case 'error':
        return errorMessage || 'Error de conexión con Aztec'
      default:
        return 'Desconectado de Aztec'
    }
  }

  return (
    <div className={`rounded-lg border p-4 ${getStatusColor()} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <span className="text-lg">{getStatusIcon()}</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">
              {getStatusMessage()}
            </div>
            {status === 'error' && (
              <div className="text-xs mt-1 opacity-75">
                La funcionalidad de blockchain no estará disponible hasta restablecer la conexión
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {status === 'error' && canRetry && (
            <Button
              size="sm"
              variant="secondary"
              onClick={retry}
              disabled={isConnecting}
              className="text-xs"
            >
              {isConnecting ? 'Reintentando...' : 'Reintentar'}
            </Button>
          )}
          
          {status === 'error' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={clearError}
              className="text-xs"
            >
              Cerrar
            </Button>
          )}
        </div>
      </div>

      {process.env.NODE_ENV === 'development' && status === 'error' && (
        <details className="mt-3">
          <summary className="text-xs cursor-pointer opacity-60 hover:opacity-100">
            Detalles técnicos
          </summary>
          <div className="mt-2 text-xs font-mono bg-black bg-opacity-10 p-2 rounded">
            <div>Estado: {status}</div>
            <div>Error: {errorMessage}</div>
            <div>Puede reintentar: {canRetry ? 'Sí' : 'No'}</div>
          </div>
        </details>
      )}
    </div>
  )
}

export function AztecConnectionBadge({ className = '' }: { className?: string }) {
  const { status, isConnected } = useAztecConnection()

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-blue-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-yellow-500'
    }
  }

  const getTooltip = () => {
    switch (status) {
      case 'connected':
        return 'Conectado a Aztec'
      case 'connecting':
        return 'Conectando a Aztec...'
      case 'error':
        return 'Error de conexión con Aztec'
      default:
        return 'Desconectado de Aztec'
    }
  }

  return (
    <div 
      className={`inline-flex items-center space-x-2 ${className}`}
      title={getTooltip()}
    >
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      <span className="text-xs text-muted-foreground">
        {isConnected ? 'Aztec' : 'Aztec (Offline)'}
      </span>
    </div>
  )
}
