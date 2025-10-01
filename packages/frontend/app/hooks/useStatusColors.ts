'use client'

import React from 'react'
import Image from 'next/image'
import { MarketStatus, BetStatus } from '@/types'

interface UseStatusReturn {
  getMarketStatusColor: (status: MarketStatus) => string
  getBetStatusColor: (status: BetStatus) => string
  getStatusIcon: (status: string | null | undefined) => React.JSX.Element
}

export function useStatus(): UseStatusReturn {
  const ICON_DIMENSIONS = { width: 24, height: 24 } as const

  const STATUS_ICON_STRATEGIES = {
    open: { src: "/clock.svg", alt: "Open" },
    finalized: { src: "/warning.svg", alt: "Finalized" },
    resolved: { src: "/success.svg", alt: "Resolved" },
    pending: { src: "/clock.svg", alt: "Pending" },
    confirmed: { src: "/check.svg", alt: "Confirmed" },
    failed: { src: "/warning.svg", alt: "Failed" },
    won: { src: "/success.svg", alt: "Won" },
    lost: { src: "/warning.svg", alt: "Lost" },
    claimable: { src: "/chart-line.svg", alt: "Claimable" },
    claimed: { src: "/success.svg", alt: "Claimed" },
    default: { src: "/file.svg", alt: "Unknown" }
  } as const

  const getMarketStatusColor = (status: MarketStatus): string => {
    switch (status) {
      case "open":
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case "finalized":
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case "resolved":
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getBetStatusColor = (status: BetStatus): string => {
    switch (status) {
      case 'confirmed':
        return 'text-foreground'
      case 'claimable':
        return 'text-foreground'
      case 'claimed':
        return 'text-foreground/50'
      case 'won':
        return 'text-foreground/50'
      case 'lost':
        return 'text-foreground/50'
      case 'failed':
        return 'text-foreground/50'
      case 'pending':
        return 'text-foreground'
      default:
        return 'text-foreground'
    }
  }

  const getStatusIcon = (status: string | null | undefined): React.JSX.Element => {
    const strategy = STATUS_ICON_STRATEGIES[status as keyof typeof STATUS_ICON_STRATEGIES] 
      || STATUS_ICON_STRATEGIES.default
    
    return <Image src={strategy.src} alt={strategy.alt} {...ICON_DIMENSIONS} />
  }

  return {
    getMarketStatusColor,
    getBetStatusColor,
    getStatusIcon
  }
}
