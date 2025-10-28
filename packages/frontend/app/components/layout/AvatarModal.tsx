'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import ConnectButton from '@/components/ui/ConnectButton'
import { TokenInfoBadge } from '@/components/ui/TokenInfo'
import { useDefaultTokenInfo } from '@/hooks/useTokenInfo'
import { useWallet } from '@/context'
import { AztecConnectionBadge } from '@/components/AztecConnectionStatus'
import dynamic from 'next/dynamic'
import { useAccount } from 'wagmi'

const EvmConnectButton = dynamic(
  () => import('@/components/ui/EvmConnectButton').then(mod => ({ default: mod.EvmConnectButton })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center space-x-2">
        <div className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-md">
          Loading...
        </div>
      </div>
    )
  }
)

const NetworkBadge = () => {
  const { chain, isConnected } = useAccount()

  if (!isConnected || !chain) {
    return (
      <div className="px-4 py-3 bg-muted/50 border border-border rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          <span className="text-sm text-muted-foreground">Not connected</span>
        </div>
      </div>
    )
  }

  const getNetworkInfo = () => {
    switch (chain.id) {
      case 421614:
        return {
          name: 'Arbitrum Sepolia',
          color: 'blue',
          bgColor: 'bg-blue-500/20',
          borderColor: 'border-blue-500/30',
          textColor: 'text-blue-400',
          dotColor: 'bg-blue-400'
        }
      case 31337:
        return {
          name: 'Anvil Local',
          color: 'purple',
          bgColor: 'bg-purple-500/20',
          borderColor: 'border-purple-500/30',
          textColor: 'text-purple-400',
          dotColor: 'bg-purple-400'
        }
      default:
        return {
          name: chain.name,
          color: 'gray',
          bgColor: 'bg-gray-500/20',
          borderColor: 'border-gray-500/30',
          textColor: 'text-gray-400',
          dotColor: 'bg-gray-400'
        }
    }
  }

  const networkInfo = getNetworkInfo()

  return (
    <div className={cn('px-4 py-3 border rounded-lg', networkInfo.bgColor, networkInfo.borderColor)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={cn('w-2 h-2 rounded-full', networkInfo.dotColor)}></div>
          <span className={cn('text-sm font-medium', networkInfo.textColor)}>
            {networkInfo.name}
          </span>
        </div>
        <span className={cn('text-xs', networkInfo.textColor, 'opacity-70')}>
          Chain ID: {chain.id}
        </span>
      </div>
    </div>
  )
}

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
  const { status: walletStatus, isConnected, disconnectWallet } = useWallet()
  const tokenInfoResult = useDefaultTokenInfo()
  const connectionKey = `${walletStatus}-${isConnected}`
  const { tokenInfo, isLoading, error } = tokenInfoResult

  const clearLocalStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear()
      window.location.reload()
    }
  }

  const handleDisconnect = () => {
    disconnectWallet()
    onClose()
  }

  const handleClearCache = () => {
    clearLocalStorage()
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      
      <div 
        className="fixed top-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-card border border-border rounded-lg shadow-lg p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">User Menu</h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 hover:bg-muted rounded-md transition-colors"
            type="button"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Active Network</div>
          <NetworkBadge />
          <EvmConnectButton />

        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Aztec Network</div>
          <div className="space-y-2">
            <AztecConnectionBadge />
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Token Information</div>
          <TokenInfoBadge
            tokenInfo={tokenInfo}
            loading={isLoading}
            error={error}
            key={connectionKey}
          />
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Actions</div>
          <div className="space-y-2">
            <button
              onClick={handleDisconnect}
              className="w-full px-3 py-2 text-sm bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 rounded-md transition-colors text-left"
            >
              Disconnect Aztec
            </button>
            <button
              onClick={handleClearCache}
              className="w-full px-3 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-md transition-colors text-left"
            >
              Clear Cache
            </button>
            <div className="pt-2">
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export { AvatarButton, AvatarModal }
export type { AvatarButtonProps, AvatarModalProps }
