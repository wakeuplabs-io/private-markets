'use client'

import React from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Market, MarketOption } from '@/types'

interface MarketCardProps {
  market: Market
  onOptionClick?: (marketId: string, option: MarketOption) => void
  onConnectWallet?: () => void
  isWalletConnected?: boolean
  className?: string
}

const MarketCard: React.FC<MarketCardProps> = ({
  market,
  onOptionClick,
  onConnectWallet,
  isWalletConnected = false,
  className
}) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date)
  }

  const formatChanceText = (percentage?: number) => {
    if (percentage === undefined) return 'Unknown chance'
    return `${percentage}% chance`
  }

  const handleOptionClick = (option: MarketOption) => {
    if (!isWalletConnected) {
      onConnectWallet?.()
    } else {
      onOptionClick?.(market.id, option)
    }
  }

  return (
    <div
      className={cn(
        'bg-card/65 backdrop-blur-sm rounded border border-border p-4',
        'flex flex-col gap-4 hover:bg-card/80 transition-colors',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded bg-muted/50 overflow-hidden flex-shrink-0">
          {market.imageUrl ? (
            <Image
              src={market.imageUrl}
              alt={market.question}
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
              <span className="text-lg">🔮</span>
            </div>
          )}
        </div>

        <h3 className="font-heading font-bold text-lg text-foreground leading-tight flex-1">
          {market.question}
        </h3>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-background px-2 py-1 rounded">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-foreground">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
            <path d="M6 3v3l2 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          <span className="text-xs text-foreground font-normal">
            {formatDate(market.closingDate)}
          </span>
        </div>

        {/* Chance Pill */}
        <div className="flex items-center gap-2 bg-background px-2 py-1 rounded">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-foreground">
            <path d="M6 1L8 4H4L6 1Z" stroke="currentColor" strokeWidth="1" fill="none"/>
            <path d="M6 11L4 8H8L6 11Z" stroke="currentColor" strokeWidth="1" fill="none"/>
          </svg>
          <span className="text-xs text-foreground font-normal">
            {formatChanceText(market.chancePercentage)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          className="flex-1 h-12 bg-[hsl(var(--yes-button))] hover:bg-[hsl(var(--yes-button))]/90 text-background font-bold text-base rounded-full"
          onClick={() => handleOptionClick('yes')}
        >
          Yes
        </Button>

        <Button
          className="flex-1 h-12 bg-[hsl(var(--no-button))] hover:bg-[hsl(var(--no-button))]/90 text-foreground font-bold text-base rounded-full"
          onClick={() => handleOptionClick('no')}
        >
          No
        </Button>
      </div>
    </div>
  )
}

export { MarketCard }
export type { MarketCardProps }