'use client'

import React from 'react'
import { Market } from '@/types'
import { Button } from '@/components/ui/Button'

interface AdminMarketGridProps {
  markets: Market[]
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

  const sortedMarkets = React.useMemo(() => {
    return [...markets].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }, [markets])

  // Helper function to get status icon
  const getStatusIcon = (status: string) => {
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

  // Helper function to format dates
  const formatDate = (date: Date, prefix: string) => {
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }
    return `${prefix}: ${date.toLocaleDateString('en-US', options)}`
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg overflow-hidden">
          <div className="p-8 text-center">
            <div className="text-muted-foreground">Loading markets...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {sortedMarkets.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">📊</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No markets found
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first prediction market to get started
          </p>
          <Button onClick={onCreateMarket}>
            Create Market
          </Button>
        </div>
      )}

      {sortedMarkets.length > 0 && (
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
                  <tr key={market.id} className="border-t border-border h-20">
                    {/* Market Column */}
                    <td className="p-6">
                      <div className="flex items-start space-x-3">
                        <span className="text-lg">{getStatusIcon(market.status)}</span>
                        <div>
                          <h3 className="font-medium text-foreground text-sm mb-1">
                            {market.question}
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
                          {market.winningOption?.name.toLowerCase() === 'yes' ? (
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
                          {market.status}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}