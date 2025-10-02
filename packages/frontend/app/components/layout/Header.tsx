'use client'

import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import ConnectButton from '@/components/ui/ConnectButton'
import { TokenInfoBadge } from '@/components/ui/TokenInfo'
import TokenActionsDropdown from '@/components/ui/TokenActionsDropdown'
import { useDefaultTokenInfo } from '@/hooks/useTokenInfo'
import { useWallet } from '@/context'
import { useAdmin } from '@/hooks/useAdmin'
import { AztecConnectionBadge } from '@/components/AztecConnectionStatus'
import dynamic from 'next/dynamic'

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

interface HeaderProps {
  className?: string
}

const Header: React.FC<HeaderProps> = ({
  className
}) => {
  const { status: walletStatus, isConnected, disconnectWallet, wallet } = useWallet();
  const tokenInfoResult = useDefaultTokenInfo();
  useAdmin(wallet?.address);
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
        'bg-card/70',
        className
      )}
    >
      <div className="flex items-center justify-between h-full px-8 max-w-[1565px] mx-auto">
        <div className="flex items-center space-x-6">
          <Link href="/">
            <h1 className="text-xl text-foreground hover:text-primary transition-colors cursor-pointer">
              PRIVATE <span className="font-bold">MARKETS</span>
            </h1>
          </Link>

          <nav className="flex items-center space-x-4">
            <Link
              href="/markets"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Markets
            </Link>

            <Link
              href="/activity"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              My Activity
            </Link>

            {true && (
              <Link
                href="/admin"
                className="flex items-center space-x-2 px-3 py-2 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-md transition-colors"
              >
                <span>⚙️</span>
                <span>Admin</span>
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <AztecConnectionBadge />
          <EvmConnectButton />
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
            title="Disconnect Aztec wallet"
          >
            Disconnect Aztec
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