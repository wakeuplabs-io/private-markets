'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import ConnectButton from '@/components/ui/ConnectButton'
import { TokenInfoBadge } from '@/components/ui/TokenInfo'
import TokenActionsDropdown from '@/components/ui/TokenActionsDropdown'
import { useDefaultTokenInfo } from '@/hooks/useTokenInfo'
import { useWallet } from '@/context'

interface HeaderProps {
  className?: string
}

const Header: React.FC<HeaderProps> = ({
  className
}) => {
  const { status: walletStatus, isConnected, disconnectWallet } = useWallet();
  const tokenInfoResult = useDefaultTokenInfo();

  const connectionKey = `${walletStatus}-${isConnected}`;
  const { tokenInfo, isLoading, error, refetch } = tokenInfoResult;

  const clearLocalStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  return (
    <header
      className={cn(
        'relative z-10 w-full h-28 backdrop-blur-sm',
        'bg-card/70 border-b border-border',
        className
      )}
    >
      <div className="flex items-center justify-between h-full px-8 max-w-[1565px] mx-auto">
        <div className="flex items-center">
          <h1 className="text-xl text-foreground">
            PRIVATE <span className="font-bold">MARKETS</span>
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <TokenInfoBadge
            tokenInfo={tokenInfo}
            loading={isLoading}
            error={error}
            key={connectionKey}
          />
          <TokenActionsDropdown
            onSuccess={() => {
              refetch();
            }}
          />
          <button
            onClick={handleDisconnect}
            className="px-3 py-1.5 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 rounded-md transition-colors"
            title="Disconnect wallet"
          >
            Disconnect
          </button>
          <button
            onClick={clearLocalStorage}
            className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-md transition-colors"
            title="Clear localStorage and reload"
          >
            Clear Cache
          </button>
          <ConnectButton />
        </div>
      </div>
    </header>
  )
}

export { Header }
export type { HeaderProps }