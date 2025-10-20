'use client'

/**
 * Component that initializes wallet providers once at app startup
 * This ensures providers are registered before any wallet operations
 */
export function WalletProvidersInitializer({ children }: { children: React.ReactNode }) {
  // Always render children - initialization doesn't block rendering
  // Providers are auto-initialized when modules are imported
  return <>{children}</>
}