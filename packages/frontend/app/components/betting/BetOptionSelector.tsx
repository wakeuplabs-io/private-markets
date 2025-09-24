'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { MarketOption } from '@/types'

interface BetOptionSelectorProps {
  options: {
    yes: string
    no: string
  }
  selectedOption: MarketOption | null
  onOptionSelect: (option: MarketOption) => void
  className?: string
}

const BetOptionSelector: React.FC<BetOptionSelectorProps> = ({
  options,
  selectedOption,
  onOptionSelect,
  className
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      <label className="block text-sm font-medium text-foreground">
        Choose your prediction:
      </label>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onOptionSelect('yes')}
          className={cn(
            'p-4 rounded-lg border-2 transition-all duration-200',
            'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring',
            selectedOption === 'yes'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-muted/50 text-foreground hover:bg-muted/70'
          )}
        >
          <div className="text-center space-y-1">
            <div className="text-lg font-semibold">YES</div>
            <div className="text-sm opacity-90">{options.yes}</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onOptionSelect('no')}
          className={cn(
            'p-4 rounded-lg border-2 transition-all duration-200',
            'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring',
            selectedOption === 'no'
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-muted/50 text-foreground hover:bg-muted/70'
          )}
        >
          <div className="text-center space-y-1">
            <div className="text-lg font-semibold">NO</div>
            <div className="text-sm opacity-90">{options.no}</div>
          </div>
        </button>
      </div>
    </div>
  )
}

export { BetOptionSelector }
export type { BetOptionSelectorProps }