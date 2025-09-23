import { readContract, writeContract } from 'wagmi/actions'
import { config } from '@/config/wagmi'
import { PREDICTION_MARKET_ABI } from '@/constants/contracts'
import { Market, MarketStatus } from '@/types'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS as `0x${string}`

export interface ContractMarket {
  id: bigint
  question: string
  state: number
  admin: string
  createdAt: bigint
  closingTime: bigint
  resolvedAt: bigint
}

export interface ContractTotals {
  noTotal: bigint
  yesTotal: bigint
}

export interface AdminMarketData {
  totalBets: number
  yesCount: number
  noCount: number
  totalVolume: bigint
  canResolve: boolean
  canEdit: boolean
}

export interface MarketStats {
  totalMarkets: number
  activeMarkets: number
  finalizedMarkets: number
  resolvedMarkets: number
  totalVolume: bigint
  averageVolume: number
}

/**
 * Unified Market Service - Single source of truth for blockchain interaction
 * Handles both user and admin market operations
 */
export class MarketService {

  // === Core Contract Interaction ===

  static async getMarketCount(): Promise<number> {
    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured')
    }
    console.log('Getting market count from contract:', CONTRACT_ADDRESS)
    const result = await readContract(config, {
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'getMarketCount',
    })
    console.log('Market count result:', Number(result))
    return Number(result)
  }

  static async getAllMarkets(offset = 0, limit = 100): Promise<ContractMarket[]> {
    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured')
    }
    console.log('Getting all markets:', { offset, limit, contractAddress: CONTRACT_ADDRESS })
    const result = await readContract(config, {
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'getAllMarkets',
      args: [BigInt(offset), BigInt(limit)],
    })

    return result as ContractMarket[]
  }

  static async getMarket(marketId: number): Promise<ContractMarket> {
    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured')
    }

    const result = await readContract(config, {
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'getMarket',
      args: [BigInt(marketId)],
    })

    return result as ContractMarket
  }

  static async getMarketTotals(marketId: number): Promise<ContractTotals> {
    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured')
    }

    const result = await readContract(config, {
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'getAllTotals',
      args: [BigInt(marketId)],
    })

    const [noTotal, yesTotal] = result as [bigint, bigint]
    return { noTotal, yesTotal }
  }

  static async getMarketsByState(state: number): Promise<ContractMarket[]> {
    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured')
    }

    const result = await readContract(config, {
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'getMarketsByState',
      args: [state],
    })

    return result as ContractMarket[]
  }

  static async createMarket(question: string, closingTime: Date): Promise<string> {
    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured')
    }

    // Convert Date to Unix timestamp (seconds)
    const closingTimestamp = BigInt(Math.floor(closingTime.getTime() / 1000))

    const hash = await writeContract(config, {
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'createMarket',
      args: [question, closingTimestamp],
    })

    return hash
  }

  static async setWinnersRoot(marketId: number, root: string): Promise<string> {
    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured')
    }

    const hash = await writeContract(config, {
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'setWinnersRoot',
      args: [BigInt(marketId), root as `0x${string}`],
    })

    return hash
  }

  // === User-focused Methods ===

  static async getUserMarkets(): Promise<Market[]> {
    try {
      const contractMarkets = await this.getAllMarkets()
      const markets: Market[] = []

      for (const contractMarket of contractMarkets) {
        try {
          const totals = await this.getMarketTotals(Number(contractMarket.id))
          const market = this.contractMarketToMarket(contractMarket, totals)
          markets.push(market)
        } catch (err) {
          console.warn(`Failed to get totals for market ${contractMarket.id}:`, err)
          const market = this.contractMarketToMarket(contractMarket)
          markets.push(market)
        }
      }

      return markets
    } catch (error) {
      console.error('Error fetching user markets:', error)
      throw error
    }
  }

  static async getActiveMarkets(): Promise<Market[]> {
    try {
      const contractMarkets = await this.getMarketsByState(0) // OPEN = 0
      const markets: Market[] = []

      for (const contractMarket of contractMarkets) {
        try {
          const totals = await this.getMarketTotals(Number(contractMarket.id))
          const market = this.contractMarketToMarket(contractMarket, totals)
          markets.push(market)
        } catch (err) {
          console.warn(`Failed to get totals for market ${contractMarket.id}:`, err)
          const market = this.contractMarketToMarket(contractMarket)
          markets.push(market)
        }
      }

      return markets
    } catch (error) {
      console.error('Error fetching active markets:', error)
      throw error
    }
  }

  // === Admin-focused Methods ===

  static async getAdminMarkets(): Promise<Market[]> {
    try {
      const contractMarkets = await this.getAllMarkets()
      const markets: Market[] = []

      for (const contractMarket of contractMarkets) {
        try {
          const totals = await this.getMarketTotals(Number(contractMarket.id))
          const market = this.contractMarketToMarket(contractMarket, totals)

          market.admin = contractMarket.admin

          markets.push(market)
        } catch (err) {
          console.warn(`Failed to get totals for market ${contractMarket.id}:`, err)
          const market = this.contractMarketToMarket(contractMarket)
          market.admin = contractMarket.admin
          markets.push(market)
        }
      }

      return markets
    } catch (error) {
      console.error('Error fetching admin markets:', error)
      throw error
    }
  }

  static async getMarketStats(): Promise<MarketStats> {
    try {
      const [allMarkets, activeMarkets, finalizedMarkets, resolvedMarkets] = await Promise.all([
        this.getAllMarkets(),
        this.getMarketsByState(0), // OPEN
        this.getMarketsByState(1), // FINALIZED
        this.getMarketsByState(2)  // RESOLVED
      ])

      let totalVolume = BigInt(0)
      let marketsWithVolume = 0

      for (const market of allMarkets) {
        try {
          const totals = await this.getMarketTotals(Number(market.id))
          const marketVolume = totals.noTotal + totals.yesTotal
          if (marketVolume > 0) {
            totalVolume += marketVolume
            marketsWithVolume++
          }
        } catch (err) {
          console.warn(`Failed to get totals for market ${market.id}:`, err)
        }
      }

      const averageVolume = marketsWithVolume > 0
        ? Number(totalVolume) / marketsWithVolume
        : 0

      return {
        totalMarkets: allMarkets.length,
        activeMarkets: activeMarkets.length,
        finalizedMarkets: finalizedMarkets.length,
        resolvedMarkets: resolvedMarkets.length,
        totalVolume,
        averageVolume
      }
    } catch (error) {
      console.error('Error fetching market stats:', error)
      throw error
    }
  }

  static async resolveMarket(marketId: number, winningOption: 'yes' | 'no'): Promise<string> {
    try {
      // In production, this would calculate the actual Merkle root based on bets and winning option
      console.log(`Resolving market ${marketId} with winning option: ${winningOption}`)
      const winnersRoot = '0x' + '0'.repeat(64) // dummy root for now

      return await this.setWinnersRoot(marketId, winnersRoot)
    } catch (error) {
      console.error('Error resolving market:', error)
      throw error
    }
  }

  // === Helper Methods ===

  static contractMarketToMarket(contractMarket: ContractMarket, totals?: ContractTotals): Market {
    const totalBets = totals ? totals.noTotal + totals.yesTotal : BigInt(0)
    const yesTotal = totals?.yesTotal || BigInt(0)
    const noTotal = totals?.noTotal || BigInt(0)

    const chancePercentage = totalBets > 0
      ? Number((yesTotal * BigInt(100)) / totalBets)
      : 50

    const yesOdds = yesTotal > 0 ? Number(totalBets) / Number(yesTotal) : 2.0
    const noOdds = noTotal > 0 ? Number(totalBets) / Number(noTotal) : 2.0

    let status: MarketStatus
    switch (contractMarket.state) {
      case 0:
        status = 'open'
        break
      case 1:
        status = 'finalized'
        break
      case 2:
        status = 'resolved'
        break
      default:
        status = 'open'
    }

    return {
      id: contractMarket.id.toString(),
      question: contractMarket.question,
      status,
      options: [
        {
          id: 'yes',
          name: 'Yes',
          odds: Math.max(yesOdds, 1.01)
        },
        {
          id: 'no',
          name: 'No',
          odds: Math.max(noOdds, 1.01)
        }
      ],
      chancePercentage,
      createdAt: new Date(Number(contractMarket.createdAt) * 1000),
      closingDate: new Date(Number(contractMarket.closingTime) * 1000),
      admin: contractMarket.admin,
      // Optional fields
      ...(contractMarket.resolvedAt > 0 && {
        resolvedAt: new Date(Number(contractMarket.resolvedAt) * 1000)
      })
    }
  }

  static formatVolume(volume: bigint): string {
    const ethValue = Number(volume) / 1e18

    if (ethValue >= 1000) {
      return `${(ethValue / 1000).toFixed(1)}K ETH`
    } else if (ethValue >= 1) {
      return `${ethValue.toFixed(2)} ETH`
    } else if (ethValue >= 0.001) {
      return `${(ethValue * 1000).toFixed(1)}m ETH`
    } else {
      return `${(ethValue * 1000000).toFixed(0)}μ ETH`
    }
  }

  static isValidContractAddress(): boolean {
    return !!CONTRACT_ADDRESS && CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000'
  }
}