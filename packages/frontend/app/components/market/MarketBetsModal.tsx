'use client'

import React from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useMarketBets } from '@/hooks/useMarketBets'
import { MarketBetsService } from '@/services/market'
import { Market, ProcessedBet } from '@/types'
import { ExternalLink } from 'lucide-react'

interface MarketBetsModalProps {
  isOpen: boolean
  onClose: () => void
  market: Market | null
}

const MarketBetsModal: React.FC<MarketBetsModalProps> = ({
  isOpen,
  onClose,
  market,
}) => {
  const { bets, stats, isLoading, error } = useMarketBets(isOpen && market ? market.id : null)

  if (!market) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-lg"
    >
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Bet History</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {market.question}
          </p>
        </div>

        {/* Stats Summary */}
        {stats && stats.totalBets > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-background/60 px-4 py-2 rounded-lg">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-base font-semibold text-foreground">{stats.totalBets}</span>
            </div>
            <div className="flex items-center gap-2 bg-background/60 px-4 py-2 rounded-lg">
              <span className="text-sm text-muted-foreground">Yes</span>
              <span className="text-base font-semibold text-primary">{stats.yesBetsCount}</span>
            </div>
            <div className="flex items-center gap-2 bg-background/60 px-4 py-2 rounded-lg">
              <span className="text-sm text-muted-foreground">No</span>
              <span className="text-base font-semibold text-destructive">{stats.noBetsCount}</span>
            </div>
          </div>
        )}

        <div className="border-t border-border" />

        {/* Bets List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-muted-foreground">Loading bets...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                Failed to load bets: {error.message}
              </p>
            </div>
          ) : bets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No bets yet for this market</p>
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {bets.map((bet, index) => (
                <BetRow key={`${bet.betId}-${index}`} bet={bet} />
              ))}
            </div>
          )}
        </div>

        {/* Close Button */}
        <Button
          variant="ghost"
          onClick={onClose}
          className="w-full"
        >
          Close
        </Button>
      </div>
    </Modal>
  )
}

interface BetRowProps {
  bet: ProcessedBet
}

const BetRow: React.FC<BetRowProps> = ({ bet }) => {
  const formattedAmount = MarketBetsService.formatBetAmount(bet.amount)
  const isYes = bet.outcome

  const explorerUrl = `https://sepolia.arbiscan.io/tx/${bet.transactionHash}`

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-4">
        {/* Outcome Badge */}
        <span className={cn(
          "px-3 py-1 rounded-full text-sm font-medium min-w-[52px] text-center",
          isYes
            ? "bg-primary/20 text-primary"
            : "bg-destructive/20 text-destructive"
        )}>
          {isYes ? 'Yes' : 'No'}
        </span>

        {/* Amount */}
        <span className="text-base font-mono text-foreground">
          {formattedAmount}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Block Number */}
        <span className="text-sm text-muted-foreground">
          #{bet.blockNumber.toString()}
        </span>

        {/* Explorer Link */}
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          title="View on Arbiscan"
        >
          <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </a>
      </div>
    </div>
  )
}

export { MarketBetsModal }
export type { MarketBetsModalProps }
