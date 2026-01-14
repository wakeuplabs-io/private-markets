import React from 'react'
import { cn } from '@/lib/utils'
import { MarketStatus as MarketStatusType } from '@/types'

interface MarketStatusProps {
  status: MarketStatusType
  winningOption?: 'yes' | 'no'
  className?: string
}

const MarketStatus: React.FC<MarketStatusProps> = ({
  status,
  winningOption,
  className
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'open':
        return {
          text: 'Open for Betting',
          className: 'bg-primary text-primary-foreground',
          icon: '🟢'
        }
      case 'finalized':
        return {
          text: 'Betting Closed - Awaiting Resolution',
          className: 'bg-orange-500 text-white',
          icon: '⏰'
        }
      case 'resolved':
        return {
          text: winningOption ? `Resolved: ${winningOption.toUpperCase()}` : 'Resolved',
          className: 'bg-green-600 text-white',
          icon: '✅'
        }
      default:
        return {
          text: 'Unknown',
          className: 'bg-muted text-muted-foreground',
          icon: '❓'
        }
    }
  }

  const { text, className: statusClassName, icon } = getStatusConfig()

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
        statusClassName,
        className
      )}
    >
      <span className="text-xs">{icon}</span>
      <span>{text}</span>
    </div>
  )
}

export { MarketStatus }
export type { MarketStatusProps }