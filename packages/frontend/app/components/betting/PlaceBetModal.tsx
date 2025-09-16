'use client'

import React, { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { BetOptionSelector } from './BetOptionSelector'
import { AmountInput } from './AmountInput'
import { cn } from '@/lib/utils'
import { Market, MarketOption, PlaceBetData } from '@/types'

interface PlaceBetModalProps {
  isOpen: boolean
  onClose: () => void
  market: Market | null
  onPlaceBet: (betData: PlaceBetData) => Promise<void>
  isLoading?: boolean
  className?: string
}

const PlaceBetModal: React.FC<PlaceBetModalProps> = ({
  isOpen,
  onClose,
  market,
  onPlaceBet,
  isLoading = false,
  className
}) => {
  const [selectedOption, setSelectedOption] = useState<MarketOption | null>(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const validateAmount = (value: string) => {
    const numValue = parseFloat(value)
    if (!value || value === '') {
      return 'Amount is required'
    }
    if (isNaN(numValue) || numValue <= 0) {
      return 'Amount must be greater than 0'
    }
    if (numValue < 1) {
      return 'Minimum bet is 1 USDC'
    }
    if (numValue > 254) {
      return 'Maximum bet is 254 USDC'
    }
    return ''
  }

  const handleAmountChange = (newAmount: string) => {
    setAmount(newAmount)
    const validation = validateAmount(newAmount)
    setError(validation)
  }

  const handleSubmit = async () => {
    if (!market || !selectedOption) return

    const validation = validateAmount(amount)
    if (validation) {
      setError(validation)
      return
    }

    try {
      await onPlaceBet({
        marketId: market.id,
        option: selectedOption,
        amount: parseFloat(amount)
      })

      // Reset form
      setSelectedOption(null)
      setAmount('')
      setError('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bet')
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setSelectedOption(null)
      setAmount('')
      setError('')
      onClose()
    }
  }

  const isValid = selectedOption && amount && !error && !validateAmount(amount)

  if (!market) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className={cn('max-w-md', className)}
    >
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            Place Your Bet
          </h2>
          <p className="text-sm text-muted-foreground">
            Your stake and address are never exposed in the market.
          </p>
        </div>

        {/* Market Info */}
        <div className="p-4 rounded-lg bg-muted/30 space-y-3">
          <h3 className="font-semibold text-foreground">
            {market.question}
          </h3>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Closes: {new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }).format(market.closingDate)}</div>
            {market.disclaimer && (
              <div className="italic">{market.disclaimer}</div>
            )}
          </div>
        </div>

        {/* Option Selection */}
        <BetOptionSelector
          options={market.options}
          selectedOption={selectedOption}
          onOptionSelect={setSelectedOption}
        />

        {/* Amount Input */}
        <AmountInput
          amount={amount}
          onAmountChange={handleAmountChange}
          error={error}
        />

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="secondary"
            size="md"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="md"
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Placing...</span>
              </div>
            ) : (
              'Place Bet'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export { PlaceBetModal }
export type { PlaceBetModalProps }