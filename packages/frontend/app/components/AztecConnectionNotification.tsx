'use client'

import React from 'react'
import { AztecConnectionStatus } from './AztecConnectionStatus'
import { useAztecConnection } from '@/hooks/useAztecConnection'

export function AztecConnectionNotification() {
  const { status } = useAztecConnection()

  if (status === 'connected') {
    return null
  }

  return (
    <div className="mb-4">
      <AztecConnectionStatus />
    </div>
  )
}

interface AztecRequiredWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  allowPartialFunctionality?: boolean
}

export function AztecRequiredWrapper({ 
  children, 
  fallback,
  allowPartialFunctionality = true 
}: AztecRequiredWrapperProps) {
  const { isConnected, status } = useAztecConnection()

  if (!isConnected && !allowPartialFunctionality) {
    return (
      <div className="space-y-4">
        <AztecConnectionStatus />
        {fallback || (
          <div className="text-center py-8">
            <div className="text-muted-foreground">
              This functionality requires connection to the Aztec blockchain
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {status !== 'connected' && <AztecConnectionNotification />}
      {children}
    </div>
  )
}

export default AztecConnectionNotification
