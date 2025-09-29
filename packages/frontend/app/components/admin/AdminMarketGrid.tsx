'use client'

import React from 'react'
import { Market } from '@/types'
import { Button } from '@/components/ui/Button'
import { SafeRender, EmptyState, LoadingState, InvalidDataState } from '@/components/ui/Fallbacks'
import {
  isValidArray,
  isValidMarket,
  safeFormatDate,
  safeGetMarketWinningOption
} from '@/utils/typeGuards'

interface AdminMarketGridProps {
  markets: Market[] | null | undefined
  isLoading?: boolean
  onCreateMarket: () => void
  onResolveMarket: (marketId: string, winningOption: 'yes' | 'no') => void
  onEditMarket?: (marketId: string) => void
}

export const AdminMarketGrid: React.FC<AdminMarketGridProps> = ({
  markets,
  isLoading = false,
  onCreateMarket,
  onResolveMarket,
}) => {
  const getStatusIcon = (status: string | null | undefined) => {
    switch (status) {
      case 'open':
        return '⏰'
      case 'finalized':
        return '⚠️'
      case 'resolved':
        return '✅'
      default:
        return '📊'
    }
  }

  const formatDate = (date: Date | null | undefined, prefix: string) => {
    const formattedDate = safeFormatDate(date, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }, 'TBD')
    return `${prefix}: ${formattedDate}`
  }

  if (isLoading) {
    return <LoadingState message="Loading markets..." />
  }

  return (
    <SafeRender
      data={markets}
      validator={isValidArray}
      fallback={<InvalidDataState dataType="markets" onRefresh={() => window.location.reload()} />}
    >
      {(validMarkets) => (
        <AdminMarketGridContent
          markets={validMarkets}
          onCreateMarket={onCreateMarket}
          onResolveMarket={onResolveMarket}
          getStatusIcon={getStatusIcon}
          formatDate={formatDate}
        />
      )}
    </SafeRender>
  )
}

// Separate content component for better organization
interface AdminMarketGridContentProps {
  markets: Market[]
  onCreateMarket: () => void
  onResolveMarket: (marketId: string, winningOption: 'yes' | 'no') => void
  getStatusIcon: (status: string | null | undefined) => string
  formatDate: (date: Date | null | undefined, prefix: string) => string
}

const AdminMarketGridContent: React.FC<AdminMarketGridContentProps> = ({
  markets,
  onCreateMarket,
  onResolveMarket,
  getStatusIcon,
  formatDate
}) => {
  // Filter and sort only valid markets
  const validMarkets = markets.filter(isValidMarket)
  const sortedMarkets = React.useMemo(() => {
    return [...validMarkets].sort((a, b) => {
      const aTime = a.createdAt?.getTime() || 0
      const bTime = b.createdAt?.getTime() || 0
      return bTime - aTime
    })
  }, [validMarkets])

  if (sortedMarkets.length === 0) {
    return (
      <EmptyState
        title="No markets found"
        message="Create your first prediction market to get started"
        actionLabel="Create Market"
        onAction={onCreateMarket}
        icon="📊"
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-foreground">Market</th>
                <th className="text-left p-4 font-medium text-foreground">Options</th>
                <th className="text-left p-4 font-medium text-foreground">State</th>
              </tr>
            </thead>
            <tbody>
              {sortedMarkets.map((market) => (
                <AdminMarketRow
                  key={market.id}
                  market={market}
                  onResolveMarket={onResolveMarket}
                  getStatusIcon={getStatusIcon}
                  formatDate={formatDate}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Individual market row component
interface AdminMarketRowProps {
  market: Market
  onResolveMarket: (marketId: string, winningOption: 'yes' | 'no') => void
  getStatusIcon: (status: string | null | undefined) => string
  formatDate: (date: Date | null | undefined, prefix: string) => string
}

const AdminMarketRow: React.FC<AdminMarketRowProps> = ({
  market,
  onResolveMarket,
  getStatusIcon,
  formatDate
}) => {
  const winningOption = safeGetMarketWinningOption(market)

  return (
    <tr className="border-t border-border h-20">
      {/* Market Column */}
      <td className="p-6">
        <div className="flex items-start space-x-3">
          <span className="text-lg">{getStatusIcon(market.status)}</span>
          <div>
            <h3 className="font-medium text-foreground text-sm mb-1">
              {market.question || 'Untitled Market'}
            </h3>
            <div className="flex space-x-4 text-xs text-muted-foreground">
              <span>{formatDate(market.createdAt, 'Created')}</span>
              <span>
                {market.status === 'resolved' && market.resolvedAt
                  ? formatDate(market.resolvedAt, 'Closed')
                  : market.closingDate
                    ? formatDate(market.closingDate, 'Closes')
                    : 'Closes: TBD'
                }
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Options Column */}
      <td className="p-6">
        {market.status === 'open' && (
          <div className="flex space-x-2">
            <Button
              disabled
              className="px-6 py-2 h-10 bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted rounded-lg font-medium text-sm border-0"
            >
              Yes
            </Button>
            <Button
              disabled
              className="px-6 py-2 h-10 bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted rounded-lg font-medium text-sm border-0"
            >
              No
            </Button>
          </div>
        )}

        {market.status === 'finalized' && (
          <div className="flex space-x-2">
            <Button
              onClick={() => onResolveMarket(market.id, 'yes')}
              className="px-6 py-2 h-10 bg-[hsl(var(--aztec-green-shine))] hover:bg-[hsl(var(--aztec-green-shine))]/90 text-[hsl(var(--aztec-dark-blue))] font-bold text-sm rounded-lg border-0"
            >
              Yes
            </Button>
            <Button
              onClick={() => onResolveMarket(market.id, 'no')}
              className="px-6 py-2 h-10 bg-[hsl(var(--error))] hover:bg-[hsl(var(--error))]/90 text-white font-bold text-sm rounded-lg border-0"
            >
              No
            </Button>
          </div>
        )}

        {market.status === 'resolved' && (
          <div className="flex">
            {winningOption?.name?.toLowerCase() === 'yes' ? (
              <Button
                disabled
                className="px-6 py-2 h-10 bg-[hsl(var(--aztec-green-shine))] text-[hsl(var(--aztec-dark-blue))] cursor-not-allowed hover:bg-[hsl(var(--aztec-green-shine))] font-bold text-sm rounded-lg border-0"
              >
                Yes
              </Button>
            ) : (
              <Button
                disabled
                className="px-6 py-2 h-10 bg-[hsl(var(--error))] text-white cursor-not-allowed hover:bg-[hsl(var(--error))] font-bold text-sm rounded-lg border-0"
              >
                No
              </Button>
            )}
          </div>
        )}
      </td>

      {/* State Column */}
      <td className="p-6">
        <div className="flex flex-col">
          {market.status === 'finalized' && (
            <p className="text-xs text-[hsl(var(--error))] mb-2 max-w-xs">
              You must select and publish the final result. Participants are waiting.
            </p>
          )}
          <div className="text-sm font-medium text-muted-foreground capitalize">
            {market.status || 'unknown'}
          </div>
        </div>
      </td>
    </tr>
  )
}