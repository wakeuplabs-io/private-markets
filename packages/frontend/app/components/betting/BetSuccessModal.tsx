'use client'

import React from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CheckCircle, Clock } from 'lucide-react'
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

        {/* Settlement Notice */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Your bet will reflect in the market in ~15 minutes after cross-chain settlement via Wormhole.</span>
        </div>

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
