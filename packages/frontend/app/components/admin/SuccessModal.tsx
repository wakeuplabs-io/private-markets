'use client'

import React from 'react'
import { Market } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SafeRender, InvalidDataState } from '@/components/ui/Fallbacks'
import {
  isValidMarket,
  safeGetProperty,
  safeGetMarketClosingDate,
  safeFormatDate
} from '@/utils/typeGuards'

interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  onViewMarket: () => void
  onCreateAnother: () => void
  createdMarket: Market | null | undefined
}

export function SuccessModal({
  isOpen,
  onClose,
  onViewMarket,
  onCreateAnother,
  createdMarket
}: SuccessModalProps) {
  const formatDate = (date: Date | null | undefined): string => {
    return safeFormatDate(date, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }, 'TBD')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-foreground mb-1">
            Market Created Successfully
          </h2>

          <p className="text-sm text-muted-foreground">
            Your prediction market is ready
          </p>
        </div>

        <SafeRender
          data={createdMarket}
          validator={isValidMarket}
          fallback={
            <InvalidDataState
              dataType="market"
              onRefresh={() => window.location.reload()}
            />
          }
        >
          {(validMarket) => (
            <SuccessModalContent
              market={validMarket}
              formatDate={formatDate}
              onViewMarket={onViewMarket}
              onCreateAnother={onCreateAnother}
            />
          )}
        </SafeRender>
      </div>
    </Modal>
  )
}

// Separate content component for better organization
interface SuccessModalContentProps {
  market: Market
  formatDate: (date: Date | null | undefined) => string
  onViewMarket: () => void
  onCreateAnother: () => void
}

const SuccessModalContent: React.FC<SuccessModalContentProps> = ({
  market,
  formatDate,
  onViewMarket,
  onCreateAnother
}) => {
  const question = safeGetProperty(market, 'question', 'Untitled Market')
  const closingDate = safeGetMarketClosingDate(market)

  return (
    <>
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Market Question
          </label>
          <p className="text-foreground p-3 bg-muted rounded-lg text-sm">
            {question}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Closing Date
          </label>
          <p className="text-foreground p-3 bg-muted rounded-lg text-sm">
            {formatDate(closingDate)}
          </p>
        </div>

        {market.status && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Status
            </label>
            <p className="text-foreground p-3 bg-muted rounded-lg text-sm capitalize">
              {market.status}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-center space-x-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCreateAnother}
          size="sm"
        >
          Create Another
        </Button>

        <Button
          type="button"
          onClick={onViewMarket}
          size="sm"
        >
          View Markets
        </Button>
      </div>
    </>
  )
}