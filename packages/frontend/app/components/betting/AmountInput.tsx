'use client'

import React from 'react'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { Lightbulb } from 'lucide-react'

interface AmountInputProps {
  amount: string
  onAmountChange: (amount: string) => void
  min?: number
  max?: number
  error?: string
  className?: string
}

const AmountInput: React.FC<AmountInputProps> = ({
  amount,
  onAmountChange,
  min = 1,
  max = 254,
  error,
  className
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      <Input
        type="number"
        label="Bet Amount (USDC)"
        placeholder={`Enter amount (${min}-${max})`}
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        min={min}
        max={max}
        error={error}
        className="text-lg font-medium"
      />

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Lightbulb className="h-3 w-3" />
        You&apos;ll need ETH for gas and USDC for your bet
      </p>

      <div className="flex gap-2">
        <span className="text-sm text-muted-foreground self-center">Quick:</span>
        {[10, 25, 50, 100].map((quickAmount) => (
          <button
            key={quickAmount}
            type="button"
            onClick={() => onAmountChange(quickAmount.toString())}
            className={cn(
              'px-3 py-1 rounded-md text-sm font-medium transition-colors',
              'border border-border hover:bg-muted',
              amount === quickAmount.toString() && 'bg-primary text-primary-foreground'
            )}
          >
            {quickAmount}
          </button>
        ))}
      </div>
    </div>
  )
}

export { AmountInput }
export type { AmountInputProps }