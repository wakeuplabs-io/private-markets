'use client'

import React, { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AmountInput } from './AmountInput'
import { SafeRender, InvalidDataState } from '@/components/ui/Fallbacks'
import { cn } from '@/lib/utils'
import { Clock, Lock } from 'lucide-react'
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
  className?: string
}

const PlaceBetModal: React.FC<PlaceBetModalProps> = ({
  isOpen,
  onClose,
  market,
  selectedOption: selectedOptionProp,
  onPlaceBet,
  className
}) => {
  const [selectedOption, setSelectedOption] = useState<MarketOption | null>(null)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  // Progress state - managed here to persist across renders
  const [progress, setProgress] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync selected option from parent when modal opens or prop changes
  useEffect(() => {
    if (isOpen) {
      setSelectedOption(selectedOptionProp ?? null)
    }
  }, [isOpen, selectedOptionProp])

  // Progress animation for 1 minute wait
  useEffect(() => {
    if (!isSubmitting) {
      setProgress(0)
      return
    }

    const duration = 80000 // 80 seconds
    const interval = 100 // Update every 100ms
    const increment = (interval / duration) * 100

    const timer = setInterval(() => {
      setProgress(prev => prev >= 100 ? 100 : prev + increment)
    }, interval)

    return () => clearInterval(timer)
  }, [isSubmitting])

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

    setIsSubmitting(true)
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
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
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
        <div className="text-left space-y-3">
          <h2 className="text-2xl font-bold text-foreground">
            Place Your Bet
          </h2>
          <div className="text-xs text-muted-foreground space-y-1.5">
            <p className="flex items-start gap-1.5">
              <Lock className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>Your stake and identity remain private on Aztec.</span>
            </p>
            <p className="flex items-start gap-1.5">
              <Clock className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>Bet confirmation takes ~1 min. Cross-chain settlement to Arbitrum takes ~15 min.</span>
            </p>
          </div>
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
              isValid={!!isValid}
              isSubmitting={isSubmitting}
              progress={progress}
              handleSubmit={handleSubmit}
              handleClose={handleClose}
            />
          )}
        </SafeRender>
      </div>
    </Modal>
  )
}

interface PlaceBetModalContentProps {
  market: Market
  selectedOption: MarketOption | null
  amount: string
  handleAmountChange: (amount: string) => void
  error: string
  isValid: boolean
  isSubmitting: boolean
  progress: number
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
  isSubmitting,
  progress,
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
          disabled={isSubmitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          variant="default"
          size="md"
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          className={cn(
            "flex-1 relative overflow-hidden",
            isSubmitting && "disabled:opacity-100 bg-primary/60"
          )}
        >
          {isSubmitting && (
            <div
              className="absolute inset-0 transition-all duration-100 ease-linear"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, hsl(var(--accent)) 0%, hsl(var(--accent) / 0.7) 100%)'
              }}
            />
          )}
          <span className="relative z-10">
            {isSubmitting ? `Placing... ${Math.round(progress)}%` : 'Place Bet'}
          </span>
        </Button>
      </div>
    </div>
  )
}

export { PlaceBetModal }
export type { PlaceBetModalProps }
