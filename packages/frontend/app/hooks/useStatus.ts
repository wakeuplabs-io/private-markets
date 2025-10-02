import { MarketStatus, BetStatus } from '@/types'

interface StatusIconInfo {
  src: string
  alt: string
}

interface UseStatusReturn {
  getMarketStatusColor: (status: MarketStatus) => string
  getBetStatusColor: (status: BetStatus) => string
  getStatusIconInfo: (status: string | null | undefined) => StatusIconInfo
}

export function useStatus(): UseStatusReturn {
  const STATUS_ICON_STRATEGIES: Record<string, StatusIconInfo> = {
    open: { src: "/clock.svg", alt: "Open" },
    finalized: { src: "/warning.svg", alt: "Finalized" },
    resolved: { src: "/success.svg", alt: "Resolved" },
    default: { src: "/file.svg", alt: "Unknown" }
  }

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

  const getStatusIconInfo = (status: string | null | undefined): StatusIconInfo => {
    return STATUS_ICON_STRATEGIES[status as keyof typeof STATUS_ICON_STRATEGIES] 
      || STATUS_ICON_STRATEGIES.default
  }

  return {
    getMarketStatusColor,
    getBetStatusColor,
    getStatusIconInfo
  }
}
