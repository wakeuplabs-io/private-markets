'use client'

import React, { useState } from 'react'
import { AdminMarket } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface AdminMarketCardProps {
  market: AdminMarket
  onResolve: (winningOption: 'yes' | 'no') => void
  onEdit: () => void
  onDelete: () => void
}

export const AdminMarketCard: React.FC<AdminMarketCardProps> = ({
  market,
  onResolve,
  onEdit,
  onDelete
}) => {
  const [showResolveOptions, setShowResolveOptions] = useState(false)

  const getStatusColor = (status: AdminMarket['status']) => {
    switch (status) {
      case "active":
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case "closed":
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case "resolved":
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEngagementColor = (engagement: number) => {
    if (engagement >= 80) return 'text-green-400'
    if (engagement >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }
  return (
    <Card className="h-full bg-card/50 backdrop-blur-sm border border-border">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground text-sm leading-tight mb-2">
              {market.question}
            </h3>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(market.status)}`}>
              {market.status.toUpperCase()}
            </span>
          </div>

          {market.imageUrl && (
            <img
              src={market.imageUrl}
              alt="Market"
              className="w-12 h-12 rounded-lg object-cover ml-3"
            />
          )}
        </div>

        <div className="space-y-2">
          {market.options.map((option) => (
            <div key={option.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{option.name.toUpperCase()}:</span>
              <span className="text-foreground">{option.odds}x</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 py-3 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Total Bets</p>
            <p className="text-sm font-semibold text-foreground">{market.bets.total}</p>
            <p className="text-xs text-muted-foreground">
              {market.bets.yesCount}Y / {market.bets.noCount}N
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Volume</p>
            <p className="text-sm font-semibold text-foreground">
              {market.bets.totalVolume.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Views</p>
            <p className="text-sm font-semibold text-foreground">
              {market.performance.views.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Engagement</p>
            <p className={`text-sm font-semibold ${getEngagementColor(market.performance.engagement)}`}>
              {market.performance.engagement}%
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span className="text-foreground">{formatDate(market.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Closes:</span>
            <span className="text-foreground">
              {formatDate(market.closingDate)} at {formatTime(market.closingDate)}
            </span>
          </div>
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
              {market.winningOption.name} (odds: {market.winningOption.odds})
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-border">
          {!showResolveOptions ? (
            <div className="flex flex-wrap gap-2">
              {market.adminActions.canResolve && market.status === "active" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowResolveOptions(true)}
                  className="flex-1"
                >
                  Resolve Market
                </Button>
              )}

              {market.adminActions.canEdit && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onEdit}
                  className="flex-1"
                >
                  Edit
                </Button>
              )}

              {market.adminActions.canDelete && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onDelete}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                >
                  Delete
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Select winning option:</p>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onResolve('yes')}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  YES Wins
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onResolve('no')}
                  className="flex-1 bg-red-600 hover:bg-red-700"
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