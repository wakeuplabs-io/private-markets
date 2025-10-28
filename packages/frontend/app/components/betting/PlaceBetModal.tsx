'use client'

import React, { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
// Bet option now comes from MarketCard click; selector removed
import { AmountInput } from './AmountInput'
import { SafeRender, InvalidDataState, LoadingState } from '@/components/ui/Fallbacks'
import { cn } from '@/lib/utils'
import { Market, MarketOption, PlaceBetData } from '@/types'
import {
  isValidMarket,
  safeGetMarketClosingDate,
  isValidMarketOptionChoice,
  isValidAmount,
  safeFormatDate
} from '@/utils/typeGuards'

interface PlaceBetModalProps {
  isOpen: boolean
  onClose: () => void
  market: Market | null | undefined
  selectedOption: MarketOption | null
  onPlaceBet: (betData: PlaceBetData) => Promise<void>
  isLoading?: boolean
  className?: string
}

const PlaceBetModal: React.FC<PlaceBetModalProps> = ({
  isOpen,
  onClose,
  market,
  selectedOption: selectedOptionProp,
  onPlaceBet,
  isLoading = false,
  className
}) => {
  // Option now provided externally
  const [selectedOption, setSelectedOption] = useState<MarketOption | null>(null)
  
  // Sync selected option from parent when modal opens or prop changes
  useEffect(() => {
    if (isOpen) {
      setSelectedOption(selectedOptionProp ?? null)
    }
  }, [isOpen, selectedOptionProp])
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
    if (!isValidMarket(market) || !isValidMarketOptionChoice(selectedOption)) {
      setError('Invalid market or option selected')
      return
    }

    const validation = validateAmount(amount)
    if (validation) {
      setError(validation)
      return
    }

    if (!isValidAmount(amount)) {
      setError('Invalid amount')
      return
    }

    try {
      await onPlaceBet({
        marketId: market.id,
        option: selectedOption,
        amount: parseFloat(amount)
      })

      setSelectedOption(null)
      setAmount('')
      setError('')
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className={cn('max-w-md', className)}
    >
      <div className="p-8 space-y-8">
        <div className="text-left space-y-2">
          <h2 className="text-2xl font-bold text-foreground ">
            Place Your Bet
          </h2>
          <p className="text-sm text-muted-foreground">
            Your stake and address are never exposed in the market.
          </p>
        </div>

        <SafeRender
          data={market}
          validator={isValidMarket}
          fallback={
            <InvalidDataState
              dataType="market"
              onRefresh={() => window.location.reload()}
            />
          }
        >
          {(validMarket) => (
            <PlaceBetModalContent
              market={validMarket}
              selectedOption={selectedOption}
              amount={amount}
              handleAmountChange={handleAmountChange}
              error={error}
              isValid={isValid || false}
              isLoading={isLoading}
              handleSubmit={handleSubmit}
              handleClose={handleClose}
            />
          )}
        </SafeRender>
      </div>
    </Modal>
  )
}

// Separate content component for better organization
interface PlaceBetModalContentProps {
  market: Market
  selectedOption: MarketOption | null
  amount: string
  handleAmountChange: (amount: string) => void
  error: string
  isValid: boolean | string
  isLoading: boolean
  handleSubmit: () => void
  handleClose: () => void
}

const PlaceBetModalContent: React.FC<PlaceBetModalContentProps> = ({
  market,
  selectedOption,
  amount,
  handleAmountChange,
  error,
  isValid,
  isLoading,
  handleSubmit,
  handleClose
}) => {
  const closingDate = safeGetMarketClosingDate(market)

  const formatClosingDate = () => {
    if (!closingDate) return 'TBD'

    return safeFormatDate(closingDate, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }, 'TBD')
  }

  return (
    <div className="space-y-8">
      <div className="p-4 rounded-lg bg-muted space-y-4 mb-8">
        <h3 className="font-semibold text-foreground text-lg">
          {market.question || 'Untitled Market'}
        </h3>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Selected option:</span>
            <span className="font-medium text-foreground">{selectedOption ? selectedOption === 'yes' ? 'Yes' : 'No' : '—'}</span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Closing date:</span>
            <span className="font-medium text-foreground">{formatClosingDate()}</span>
          </div>
        </div>
        
        {market.disclaimer && (
          <div className="text-xs text-muted-foreground italic pt-2 border-t border-border/50">
            {market.disclaimer}
          </div>
        )}
      </div>

      <AmountInput
        amount={amount}
        onAmountChange={handleAmountChange}
        error={error}
      />

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
            <LoadingState
              message="Placing..."
              variant="minimal"
              className="justify-center"
            />
          ) : (
            'Place Bet'
          )}
        </Button>
      </div>
    </div>
  )
}

export { PlaceBetModal }
export type { PlaceBetModalProps }