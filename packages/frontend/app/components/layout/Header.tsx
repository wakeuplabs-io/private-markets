'use client'

import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useWallet } from '@/context'
import { useAdmin } from '@/hooks/useAdmin'
import { useDefaultTokenInfo } from '@/hooks/useTokenInfo'
import { useUSDCBalance } from '@/hooks/useEVMTokenBalance'
import TokenActionsDropdown from '@/components/ui/TokenActionsDropdown'
import { AvatarButton } from './AvatarModal'

interface HeaderProps {
  className?: string
  onAvatarClick: () => void
}

const Header: React.FC<HeaderProps> = ({
  className,
  onAvatarClick
}) => {
  const { wallet } = useWallet();
  useAdmin(wallet?.address);
  const tokenInfoResult = useDefaultTokenInfo();
  const evmTokenResult = useUSDCBalance();
  const { refetch } = tokenInfoResult;
  const { refetch: refetchEvmBalance } = evmTokenResult;

  return (
    <header
      className={cn(
        'relative z-40 w-screen h-20 backdrop-blur-sm',
        'bg-card/70',
        className
      )}
    >
      <div className="flex items-center justify-between h-full px-8 w-screen max-w-[1565px] mx-auto">
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

            <Link
              href="/admin"
              className="px-3 py-2 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-md transition-colors"
            >
              Create Market
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <TokenActionsDropdown
            evmTokenAddress={process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined}
            onSuccess={() => {
              refetch();
              refetchEvmBalance();
            }}
          />
          <AvatarButton onClick={onAvatarClick} />
        </div>
      </div>
    </header>
  )
}

export { Header }
export type { HeaderProps }