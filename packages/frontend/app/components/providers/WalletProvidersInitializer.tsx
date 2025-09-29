'use client'

import { useEffect, useState } from 'react'
import { initializeWalletProviders } from '@/lib/wallet/providers'

/**
 * Component that initializes wallet providers once at app startup
 * This ensures providers are registered before any wallet operations
 */
export function WalletProvidersInitializer({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    // Providers are auto-initialized when the module is imported
    // This component just marks initialization as complete for UI purposes
    setInitialized(true)
  }, [])

  // Always render children - initialization doesn't block rendering
  // but providers will be available for wallet operations
  return <>{children}</>
}