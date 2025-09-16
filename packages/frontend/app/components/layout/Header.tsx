'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import ConnectAzguardButton from '@/components/ui/ConnectAzguardButton'
import { TokenInfoBadge } from '@/components/ui/TokenInfo'
import { useDefaultTokenInfo } from '@/hooks/useTokenInfo'

interface HeaderProps {
  className?: string
}

const Header: React.FC<HeaderProps> = ({
  className
}) => {
  const { tokenInfo, isLoading, error } = useDefaultTokenInfo();

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
          />
          <ConnectAzguardButton />
        </div>
      </div>
    </header>
  )
}

export { Header }
export type { HeaderProps }