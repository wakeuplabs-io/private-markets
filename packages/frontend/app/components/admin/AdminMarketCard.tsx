'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { AdminMarket } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SafeRender, InvalidDataState, AdminMarketCardSkeleton } from '@/components/ui/Fallbacks'
import {
  isValidAdminMarket,
  safeGetMarketOptions,
  safeGetProperty,
  safeFormatNumber
} from '@/utils/typeGuards'
import { formatDate, formatTime } from '@/lib/utils'
import { useStatus } from '@/hooks/useStatus'

interface AdminMarketCardProps {
  market: AdminMarket | null | undefined
  onResolve: (winningOption: 'yes' | 'no') => void
  onEdit: () => void
  onDelete: () => void
  isLoading?: boolean
}

export const AdminMarketCard: React.FC<AdminMarketCardProps> = ({
  market,
  onResolve,
  onEdit,
  onDelete,
  isLoading = false
}) => {
  const [showResolveOptions, setShowResolveOptions] = useState(false)
  const { getMarketStatusColor } = useStatus()

 

  const getEngagementColor = (engagement: number | null | undefined) => {
    if (typeof engagement !== 'number' || isNaN(engagement)) return 'text-gray-400'
    if (engagement >= 80) return 'text-green-400'
    if (engagement >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  // Show skeleton while loading
  if (isLoading) {
    return <AdminMarketCardSkeleton />
  }

  return (
    <SafeRender
      data={market}
      validator={isValidAdminMarket}
      fallback={<InvalidDataState dataType="market data" />}
      skeleton={<AdminMarketCardSkeleton />}
    >
      {(validMarket) => (
        <AdminMarketCardContent
          market={validMarket}
          onResolve={onResolve}
          onEdit={onEdit}
          onDelete={onDelete}
          showResolveOptions={showResolveOptions}
          setShowResolveOptions={setShowResolveOptions}
          formatDate={formatDate}
          formatTime={formatTime}
          getEngagementColor={getEngagementColor}
          getStatusColor={getMarketStatusColor}
        />
      )}
    </SafeRender>
  )
}

// Separate content component for cleaner code
interface AdminMarketCardContentProps {
  market: AdminMarket
  onResolve: (winningOption: 'yes' | 'no') => void
  onEdit: () => void
  onDelete: () => void
  showResolveOptions: boolean
  setShowResolveOptions: (show: boolean) => void
  formatDate: (date: Date | null | undefined) => string
  formatTime: (date: Date | null | undefined) => string
  getEngagementColor: (engagement: number | null | undefined) => string
  getStatusColor: (status: AdminMarket['status']) => string
}

const AdminMarketCardContent: React.FC<AdminMarketCardContentProps> = ({
  market,
  onResolve,
  onEdit,
  onDelete,
  showResolveOptions,
  setShowResolveOptions,
  formatDate,
  formatTime,
  getEngagementColor,
  getStatusColor
}) => {
  const options = safeGetMarketOptions(market)
  const adminActions = safeGetProperty(market, 'adminActions', {
    canResolve: false,
    canEdit: false,
    canDelete: false
  })
  const bets = safeGetProperty(market, 'bets', {
    total: 0,
    yesCount: 0,
    noCount: 0,
    totalVolume: 0
  })
  const performance = safeGetProperty(market, 'performance', {
    views: 0,
    engagement: 0
  })

  return (
    <Card className="h-full bg-card/50 backdrop-blur-sm border border-border">
      <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground text-sm leading-tight mb-2">
              {market.question || 'Untitled Market'}
            </h3>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(market.status)}`}>
              {(market.status || 'unknown').toUpperCase()}
            </span>
          </div>

          {market.imageUrl && (
            <Image
              src={market.imageUrl}
              alt={market.question || "Market"}
              width={48}
              height={48}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0"
            />
          )}
        </div>

        <div className="space-y-2">
          {options.length > 0 ? (
            options.map((option) => (
              <div key={option.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{(option.name || 'Unknown').toUpperCase()}:</span>
                <span className="text-foreground">{safeFormatNumber(option.odds, undefined, '0')}x</span>
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground">No options available</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 py-3 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Total Bets</p>
            <p className="text-sm font-semibold text-foreground">{safeFormatNumber(bets.total)}</p>
            <p className="text-xs text-muted-foreground">
              {safeFormatNumber(bets.yesCount)}Y / {safeFormatNumber(bets.noCount)}N
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Volume</p>
            <p className="text-sm font-semibold text-foreground">
              {safeFormatNumber(bets.totalVolume, { style: 'decimal' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Views</p>
            <p className="text-sm font-semibold text-foreground">
              {safeFormatNumber(performance.views, { style: 'decimal' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Engagement</p>
            <p className={`text-sm font-semibold ${getEngagementColor(performance.engagement)}`}>
              {safeFormatNumber(performance.engagement)}%
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span className="text-foreground">{formatDate(market.createdAt)}</span>
          </div>
          {market.closingDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Closes:</span>
              <span className="text-foreground">
                {formatDate(market.closingDate)} at {formatTime(market.closingDate)}
              </span>
            </div>
          )}
          {market.resolvedAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Resolved:</span>
              <span className="text-foreground">{formatDate(market.resolvedAt)}</span>
            </div>
          )}
        </div>

        {market.status === 'resolved' && market.winningOption && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Winning Option:</p>
            <p className="text-sm font-semibold text-primary">
              {market.winningOption.name || 'Unknown'} (odds: {safeFormatNumber(market.winningOption.odds)})
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-border">
          {!showResolveOptions ? (
            <div className="flex flex-col gap-2">
              {adminActions.canResolve && (market.status === "open" || market.status === "finalized") && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowResolveOptions(true)}
                  className="w-full"
                >
                  Resolve Market
                </Button>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                {adminActions.canEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onEdit}
                    className="w-full sm:flex-1"
                  >
                    Edit
                  </Button>
                )}

                {adminActions.canDelete && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onDelete}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/20 w-full sm:flex-1"
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Select winning option:</p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onResolve('yes')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  YES Wins
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onResolve('no')}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  NO Wins
                </Button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowResolveOptions(false)}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}