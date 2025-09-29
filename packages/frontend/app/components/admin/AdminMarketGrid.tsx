'use client'

import React from 'react'
import Image from 'next/image'
import { Market } from '@/types'
import { Button } from '@/components/ui/Button'
import { SafeRender, EmptyState, LoadingState, InvalidDataState } from '@/components/ui/Fallbacks'
import {
  isValidArray,
  isValidMarket,
  safeFormatDate,
  safeGetMarketWinningOption
} from '@/utils/typeGuards'
import { cn } from '@/lib/utils'

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
        return <Image src="/clock.svg" alt="Open" width={24} height={24} />
      case 'finalized':
        return <Image src="/warning.svg" alt="Finalized" width={24} height={24} />
      case 'resolved':
        return <Image src="/success.svg" alt="Resolved" width={24} height={24} />
      default:
        return <Image src="/file.svg" alt="Unknown" width={24} height={24} />
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
  getStatusIcon: (status: string | null | undefined) => React.JSX.Element
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
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="w-full min-w-[800px]">
            {/* Header */}
            <div className="bg-muted rounded-lg p-4">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-7 font-normal text-muted-foreground">Market</div>
                <div className="col-span-4 font-normal text-muted-foreground">Options</div>
                <div className="col-span-1 font-medium text-muted-foreground">State</div>
              </div>
            </div>
            
            {/* Rows */}
            <div className="space-y-6 mt-4">
              {sortedMarkets.map((market) => (
                <AdminMarketRow
                  key={market.id}
                  market={market}
                  onResolveMarket={onResolveMarket}
                  getStatusIcon={getStatusIcon}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Individual market row component
interface AdminMarketRowProps {
  market: Market
  onResolveMarket: (marketId: string, winningOption: 'yes' | 'no') => void
  getStatusIcon: (status: string | null | undefined) => React.JSX.Element
  formatDate: (date: Date | null | undefined, prefix: string) => string
}

const AdminMarketRow: React.FC<AdminMarketRowProps> = ({
  market,
  onResolveMarket,
  getStatusIcon,
  formatDate
}) => {
  const winningOption = safeGetMarketWinningOption(market)

  console.log(market.status);
  const textColor = market.status === 'resolved' ? 'text-foreground/50' : 'text-foreground'
  return (
    <div className="rounded-lg bg-[#1D293D]/65 backdrop-blur-sm">
      <div className="grid grid-cols-12 gap-4 h-full items-center p-6">
        {/* Market Column */}
        <div className="col-span-7">
          <div className="flex items-start space-x-3 ">
            <span className="text-lg mt-0.5 w-6 h-6">{getStatusIcon(market.status)}</span>
            <div className="flex-1">
                <h3 className={cn("font-bold text-2xl mb-2 leading-tight", textColor)}>
                  {market.question || 'Untitled Market'}
                </h3>
              <div className={cn("flex space-x-6 text-base font-normal", textColor)}>
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
              {market.status === 'finalized' && (
              <p className="text-xs text-[hsl(var(--error))] mb-2 max-w-xs leading-tight">
                You must select and publish the final result. Participants are waiting.
              </p>
            )}
            </div>
          </div>
        </div>

        {/* Options Column */}
        <div className="col-span-4">
        {market.status === 'open' && (
          <div className="flex space-x-3">
            <Button
              disabled
              className="rounded-button"
            >
              Yes
            </Button>
            <Button
              disabled
              className="rounded-button"
            >
              No
            </Button>
          </div>
        )}

        {market.status === 'finalized' && (
          <div className="flex space-x-3">
            <Button
              onClick={() => onResolveMarket(market.id, 'yes')}
              className="rounded-button"
            >
              Yes
            </Button>
            <Button
              onClick={() => onResolveMarket(market.id, 'no')}
              className="rounded-button"
            >
              No
            </Button>
          </div>
        )}

        {market.status === 'resolved' && (
          <div className="flex space-x-3">
            {winningOption?.name?.toLowerCase() === 'yes' ? (
              <Button
                disabled
                className="rounded-button"
                variant="success"
              >
                Yes
              </Button>
            ) : (
              <Button
                disabled
                className="rounded-button"
                variant="destructive"
              >
                No
              </Button>
            )}
          </div>
        )}
        </div>

        {/* State Column */}
        <div className="col-span-1">
          <div className="flex flex-col">
            
            <div className={cn("text-sm font-bold capitalize", textColor)}>
              {market.status || 'unknown'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}