'use client'

import React from 'react'
import { Market } from '@/types'
import { Button } from '@/components/ui/Button'

interface AdminMarketGridProps {
  markets: Market[]
  isLoading?: boolean
  onCreateMarket: () => void
  onResolveMarket: (marketId: string, winningOption: 'yes' | 'no') => void
  onEditMarket: (marketId: string) => void
}

export const AdminMarketGrid: React.FC<AdminMarketGridProps> = ({
  markets,
  isLoading = false,
  onCreateMarket,
  onResolveMarket,
  onEditMarket,
}) => {

  const sortedMarkets = React.useMemo(() => {
    return [...markets].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }, [markets])

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
                  <th className="text-left p-4 font-medium text-foreground">Status</th>
                  <th className="text-left p-4 font-medium text-foreground">Bets</th>
                  <th className="text-left p-4 font-medium text-foreground">Volume</th>
                  <th className="text-left p-4 font-medium text-foreground">Created</th>
                  <th className="text-left p-4 font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedMarkets.map((market) => (
                  <tr key={market.id} className="border-t border-border">
                    <td className="p-4">
                      <div>
                        <h3 className="font-medium text-foreground text-sm">
                          {market.question}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Closes: {market.closingDate?.toLocaleDateString() || 'TBD'}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        market.status === "open"
                          ? 'bg-green-500/20 text-green-400'
                          : market.status === "finalized"
                          ? 'bg-orange-500/20 text-orange-400'
                          : market.status === "resolved"
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {market.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-foreground">
                      0
                    </td>
                    <td className="p-4 text-sm text-foreground">
                      0
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {market.createdAt.toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        {market.status === 'open' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onResolveMarket(market.id, 'yes')}
                          >
                            Resolve
                          </Button>
                        )}
                        {false && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onEditMarket(market.id)}
                          >
                            Edit
                          </Button>
                        )}
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