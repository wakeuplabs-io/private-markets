'use client'

import React from 'react'
import { MarketCard } from './MarketCard'
import { cn } from '@/lib/utils'
import { Market } from '@/types'

interface MarketGridProps {
  markets: Market[]
  onOptionClick?: (marketId: string, option: import('@/types').MarketOption) => void
  className?: string
  emptyState?: React.ReactNode
}

const MarketGrid: React.FC<MarketGridProps> = ({
  markets,
  onOptionClick,
  className,
  emptyState
}) => {
  if (markets.length === 0) {
    return (
      <div className={cn('py-16', className)}>
        {emptyState || (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                No markets available
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                There are currently no prediction markets to display.
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6',
        className
      )}
    >
      {markets.map((market) => (
        <MarketCard
          key={market.id}
          market={market}
          onOptionClick={onOptionClick}
        />
      ))}
    </div>
  )
}

export { MarketGrid }
export type { MarketGridProps }