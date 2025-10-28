'use client'

import React from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Market, MarketOption } from '@/types'
import { safeFormatDate } from '@/utils/typeGuards'

interface BetSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  market: Market | null
  selectedOption: MarketOption | null
  amount: number
  txHash?: string
  className?: string
}

export const BetSuccessModal: React.FC<BetSuccessModalProps> = ({
  isOpen,
  onClose,
  market,
  selectedOption,
  amount,
  className
}) => {
  const formatClosingDate = () => {
    if (!market?.closingDate) return 'TBD'

    const date = market.closingDate instanceof Date
      ? market.closingDate
      : new Date(market.closingDate)

    return safeFormatDate(date, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    }, 'TBD')
  }

  // const formatTxHash = (hash?: string) => {
  //   if (!hash) return ''
  //   return `${hash.slice(0, 6)}...${hash.slice(-4)}`
  // }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className={cn('max-w-md', className)}
    >
      <div className="p-8 space-y-8">
        {/* Success Icon */}
        <div className="flex justify-center">
            <CheckCircle className="w-12 h-12 text-foreground" strokeWidth={3} />
        </div>

        {/* Success Title */}
        <h2 className="text-3xl font-bold text-center text-foreground">
          Bet Placed Successfully!
        </h2>

        {/* Bet Details Card */}
        <div className="p-6 rounded-xl bg-card border border-border space-y-4">
          {/* Market Question */}
          <h3 className="font-semibold text-foreground text-lg leading-tight">
            {market?.question || 'Untitled Market'}
          </h3>

          {/* Details Grid */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Your choice:</span>
              <span className="font-bold text-medium text-foreground">
                {selectedOption === 'yes' ? 'Yes' : 'No'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-bold text-medium text-foreground">
                ${amount} USDC
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Closing date:</span>
              <span className="font-bold font-medium text-foreground">
                {formatClosingDate()}
              </span>
            </div>

            {/* {txHash && (
              <div className="flex justify-between items-center pt-2 border-t border-border/50">
                <span className="text-muted-foreground text-sm">TX Hash:</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {formatTxHash(txHash)}
                </span>
              </div>
            )} */}
          </div>
        </div>

        {/* Continue Button */}
        <Button
          variant="default"
          size="lg"
          onClick={onClose}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-lg py-6"
        >
          Continue
        </Button>
      </div>
    </Modal>
  )
}
