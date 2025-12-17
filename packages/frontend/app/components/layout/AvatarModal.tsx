'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import ConnectButton from '@/components/ui/ConnectButton'
import { TokenInfoBadge } from '@/components/ui/TokenInfo'
import { EVMTokenBalance } from '@/components/ui/EVMTokenBalance'
import { useDefaultTokenInfo } from '@/hooks/useTokenInfo'
import { useUSDCBalance } from '@/hooks/useEVMTokenBalance'
import { useWallet } from '@/context'
import { usePXEManager } from '@/hooks/pxe/usePXEManager'
import dynamic from 'next/dynamic'
import { useAccount } from 'wagmi'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const EvmConnectButton = dynamic(
  () => import('@/components/ui/EvmConnectButton').then(mod => ({ default: mod.EvmConnectButton })),
  {
    ssr: false,
    loading: () => (
      <div className="px-3 py-2 text-sm text-muted-foreground bg-muted rounded-md">
        Loading...
      </div>
    )
  }
)

interface AvatarButtonProps {
  className?: string
  onClick: () => void
}

const AvatarButton: React.FC<AvatarButtonProps> = ({ className, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center w-10 h-10 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded-full transition-colors",
        className
      )}
      title="User menu"
    >
      <div className="w-6 h-6 text-primary">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    </button>
  )
}

interface AvatarModalProps {
  isOpen: boolean
  onClose: () => void
}

const AvatarModal: React.FC<AvatarModalProps> = ({ isOpen, onClose }) => {
  const { status: walletStatus, isConnected } = useWallet()
  const tokenInfoResult = useDefaultTokenInfo()
  const evmTokenResult = useUSDCBalance()
  const pxeState = usePXEManager()
  const { isConnected: isEvmConnected } = useAccount()

  const connectionKey = `${walletStatus}-${isConnected}`
  const { tokenInfo, isLoading, error, refetch: refetchAztec } = tokenInfoResult
  const { refetch: refetchEvm } = evmTokenResult

  // State for clear cache confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Auto-refresh when pxeState.busy changes from true to false
  const prevBusy = useRef(pxeState.busy)
  useEffect(() => {
    if (prevBusy.current && !pxeState.busy) {
      refetchAztec()
      refetchEvm()
    }
    prevBusy.current = pxeState.busy
  }, [pxeState.busy, refetchAztec, refetchEvm])

  // Refetch on modal open
  useEffect(() => {
    if (isOpen) {
      refetchAztec()
      refetchEvm()
    }
  }, [isOpen, refetchAztec, refetchEvm])

  const handleClearCache = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear()
      window.location.reload()
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      />

      <div
        className="fixed top-20 right-4 w-80 max-h-[calc(100vh-100px)] overflow-y-auto overflow-x-hidden z-50 bg-card border border-border rounded-lg shadow-lg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="font-semibold text-foreground">Wallet Manager</h3>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="p-1 hover:bg-muted rounded-md transition-colors"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Operation Status - Show when busy */}
        {pxeState.busy && (
          <div className="py-3 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span className="text-sm text-foreground">
                {pxeState.message}
              </span>
            </div>
            {pxeState.queue.length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {pxeState.queue.length} operation{pxeState.queue.length > 1 ? 's' : ''} queued
              </div>
            )}
          </div>
        )}

        {/* AZTEC SECTION */}
        <div className="space-y-3 py-3">
          <h4 className="text-sm font-medium text-primary">Aztec</h4>

          <ConnectButton />

          {/* Balance with refresh */}
          {isConnected && (
            <div className="flex items-center justify-between">
              <TokenInfoBadge
                tokenInfo={tokenInfo}
                loading={isLoading}
                error={error}
                key={connectionKey}
              />
              <button
                onClick={() => refetchAztec()}
                disabled={isLoading}
                className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", isLoading && "animate-spin")} />
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-border" />

        {/* EVM SECTION */}
        <div className="space-y-3 py-3">
          <h4 className="text-sm font-medium text-primary">EVM</h4>

          <EvmConnectButton />

          {/* Balance with refresh */}
          {isEvmConnected && (
            <div className="flex items-center justify-between">
              <EVMTokenBalance
                tokenInfo={evmTokenResult.tokenInfo}
                balance={evmTokenResult.balance}
                loading={evmTokenResult.isLoading}
                error={evmTokenResult.error}
              />
              <button
                onClick={() => refetchEvm()}
                disabled={evmTokenResult.isLoading}
                className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", evmTokenResult.isLoading && "animate-spin")} />
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Footer - Clear Cache with confirmation */}
        <div className="pt-3">
          {showClearConfirm ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Clear all data?</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowClearConfirm(false)}
                  className="h-7 px-2 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleClearCache}
                  className="h-7 px-2 text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear Cache
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export { AvatarButton, AvatarModal }
export type { AvatarButtonProps, AvatarModalProps }
