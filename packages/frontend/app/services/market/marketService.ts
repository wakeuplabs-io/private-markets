import { readContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions'
import { config } from '@/config/wagmi'
import { PREDICTION_MARKET_ABI } from '@/constants/abis'
import {
  PREDICTION_MARKET_FUNCTIONS,
  PREDICTION_MARKET_GAS_LIMITS,
  PREDICTION_MARKET_PAGINATION,
} from '@/constants/contracts'
import {
  Market,
  MarketStatus,
  BlockchainConnectionStatus,
  ContractMarket,
  MarketStats,
} from '@/types'

// Re-export types for external use
export type { ContractMarket, MarketStats }
import { BlockchainStatusService } from '../blockchain/blockchainStatusService'
import { parseUnits } from 'viem'
import { evmTokenService } from '../token/evmTokenService'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS as `0x${string}`
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` // Arbitrum Sepolia USDC
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS as `0x${string}`

/**
 * Unified Market Service - Single source of truth for blockchain interaction
 * Handles both user and admin market operations
 */
export class MarketService {

  static async getMarketCount(): Promise<number> {
    if (!CONTRACT_ADDRESS) {
      console.warn('Contract address not configured, using mock data')
    }

    try {
      const result = await readContract(config, {
        address: CONTRACT_ADDRESS,
        abi: PREDICTION_MARKET_ABI,
        functionName: PREDICTION_MARKET_FUNCTIONS.GET_MARKET_COUNT,
      })
      return Number(result)
    } catch (error) {
      console.warn('Failed to get market count from blockchain, using mock data:', error instanceof Error ? error.message : 'Unknown error')
      return 0
    }
  }


  static async getMarket(marketId: number): Promise<ContractMarket> {
    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured')
    }

    const result = await readContract(config, {
      address: CONTRACT_ADDRESS,
      abi: PREDICTION_MARKET_ABI,
      functionName: PREDICTION_MARKET_FUNCTIONS.GET_MARKET,
      args: [BigInt(marketId)],
    })

    const [owner, question, totalPool, yesTotal, noTotal, resolved, winningOutcome, createdAt, expiresAt] = result as [string, string, bigint, bigint, bigint, boolean, boolean, bigint, bigint]
    
    return {
      id: BigInt(marketId),
      owner,
      question,
      totalPool,
      yesTotal,
      noTotal,
      resolved,
      winningOutcome,
      createdAt,
      expiresAt
    }
  }


  static async createMarket(question: string, totalPool: number, closingTime: Date, userAddress: string): Promise<string> {
    // Check if blockchain is available
    const isOnline = await BlockchainStatusService.isEVMOnline()
    console.log('EVM online:', isOnline)
    if (!isOnline) {
      console.info('EVM offline')
      throw new Error('Contract address not configured')
    }

    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured')
    }

    if (!userAddress) {
      throw new Error('User address is required')
    }

    try {
      const closingTimestamp = BigInt(Math.floor(closingTime.getTime() / 1000))
      const poolAmount = BigInt(totalPool)
      // USDC has 6 decimals
      const usdcAmount = parseUnits(totalPool.toString(), 6)

      // Check and approve USDC using EVMTokenService
      const currentAllowance = await evmTokenService.checkAllowance(
        USDC_ADDRESS,
        userAddress as `0x${string}`,
        TREASURY_ADDRESS
      )
      console.log('Current USDC allowance:', currentAllowance)

      if (currentAllowance < usdcAmount) {
        console.log('⚠️  Insufficient allowance. Requesting approval for', usdcAmount.toString(), 'USDC')
        await evmTokenService.approve(USDC_ADDRESS, TREASURY_ADDRESS, usdcAmount)
        console.log('✅ USDC approved')
      } else {
        console.log('✅ Sufficient allowance already exists')
      }

      // Step 3: Create market (poolAmount is the market size, NOT the USDC amount)
      const hash = await writeContract(config, {
        address: CONTRACT_ADDRESS,
        abi: PREDICTION_MARKET_ABI,
        functionName: PREDICTION_MARKET_FUNCTIONS.CREATE_MARKET,
        args: [question, poolAmount, closingTimestamp],
        gas: PREDICTION_MARKET_GAS_LIMITS.CREATE_MARKET,
      })

      const waitForConfirmation = await waitForTransactionReceipt(config, {
        hash,
        confirmations: 1,
      })

      console.log("Market created:", waitForConfirmation)
      return hash
    } catch (error) {
      console.warn('Failed to create market on blockchain:', error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }


  // === User-focused Methods ===

  static async getUserMarkets(userAddress: string): Promise<Market[]> {
    const isOnline = await BlockchainStatusService.isEVMOnline()

    if (!isOnline) {
      console.info('EVM offline, returning mock user markets')
    }

    if (!CONTRACT_ADDRESS) {
      console.warn('Contract address not configured, using mock data')
    }

    try {
      const result = await readContract(config, {
        address: CONTRACT_ADDRESS,
        abi: PREDICTION_MARKET_ABI,
        functionName: PREDICTION_MARKET_FUNCTIONS.GET_MARKETS_BY_OWNER,
        args: [userAddress as `0x${string}`, PREDICTION_MARKET_PAGINATION.DEFAULT_OFFSET, PREDICTION_MARKET_PAGINATION.DEFAULT_LIMIT],
      })

      const [marketIds, marketResults] = result as unknown as [bigint[], ContractMarket[]]
      
      return marketResults.map((contractMarket, index) => 
        this.contractMarketToMarket({ ...contractMarket, id: marketIds[index] })
      )
    } catch (error) {
      console.warn('Error fetching user markets from blockchain, using mock data:', error instanceof Error ? error.message : 'Unknown error')
      return [] as Market[]
    }
  }

  static async getActiveMarkets(): Promise<Market[]> {
    if (!CONTRACT_ADDRESS) {
      console.warn('Contract address not configured, using mock data')
    }

    try {
      const result = await readContract(config, {
        address: CONTRACT_ADDRESS,
        abi: PREDICTION_MARKET_ABI,
        functionName: PREDICTION_MARKET_FUNCTIONS.GET_ACTIVE_MARKETS,
        args: [PREDICTION_MARKET_PAGINATION.DEFAULT_OFFSET, PREDICTION_MARKET_PAGINATION.DEFAULT_LIMIT],
      })
      const [marketIds, marketResults] = result as unknown as [bigint[], ContractMarket[]]
      
      return marketResults.map((contractMarket, index) => 
        this.contractMarketToMarket({ ...contractMarket, id: marketIds[index] })
      )
    } catch (error) {
      console.error('Error fetching active markets:', error)
      throw error
    }
  }

  // === Admin-focused Methods ===

  static async getAdminMarkets(adminAddress: string): Promise<Market[]> {
    const isOnline = await BlockchainStatusService.isEVMOnline()

    if (!isOnline) {
      console.info('EVM offline, returning mock admin markets')
    }

    if (!CONTRACT_ADDRESS) {
      console.warn('Contract address not configured, using mock data')
    }

    try {
      const result = await readContract(config, {
        address: CONTRACT_ADDRESS,
        abi: PREDICTION_MARKET_ABI,
        functionName: PREDICTION_MARKET_FUNCTIONS.GET_MARKETS_BY_OWNER,
        args: [adminAddress as `0x${string}`, PREDICTION_MARKET_PAGINATION.DEFAULT_OFFSET, PREDICTION_MARKET_PAGINATION.DEFAULT_LIMIT],
      })

      const [marketIds, marketResults] = result as unknown as [bigint[], ContractMarket[]]
      
      return marketResults.map((contractMarket, index) => {
        const market = this.contractMarketToMarket({ ...contractMarket, id: marketIds[index] })
        market.admin = contractMarket.owner
        return market
      })
    } catch (error) {
      console.warn('Error fetching admin markets from blockchain, using mock data:', error instanceof Error ? error.message : 'Unknown error')
      return [] as Market[]
    }
  }

  static async getMarketStats(): Promise<MarketStats> {
    try {
      const activeMarkets = await this.getActiveMarkets()
      const totalCount = await this.getMarketCount()

      let totalVolume = BigInt(0)
      const resolvedCount = 0

      for (const market of activeMarkets) {
        const volume = BigInt(market.options[0]?.odds || 0) + BigInt(market.options[1]?.odds || 0)
        totalVolume += volume
      }

      const averageVolume = activeMarkets.length > 0
        ? Number(totalVolume) / activeMarkets.length
        : 0

      const finalizedCount = activeMarkets.filter(market =>
        market.status === 'finalized'
      ).length

      return {
        totalMarkets: totalCount,
        activeMarkets: activeMarkets.length,
        finalizedMarkets: finalizedCount,
        resolvedMarkets: resolvedCount,
        totalVolume,
        averageVolume
      }
    } catch (error) {
      console.error('Error fetching market stats:', error)
      throw error
    }
  }

  static async resolveMarket(marketId: number, winningOption: 'yes' | 'no'): Promise<string> {
    if (!CONTRACT_ADDRESS) {
      throw new Error('Contract address not configured')
    }

    try {
      const winningOutcome = winningOption === 'yes'

      const hash = await writeContract(config, {
        address: CONTRACT_ADDRESS,
        abi: PREDICTION_MARKET_ABI,
        functionName: PREDICTION_MARKET_FUNCTIONS.RESOLVE_MARKET,
        args: [BigInt(marketId), winningOutcome],
        gas: PREDICTION_MARKET_GAS_LIMITS.RESOLVE_MARKET,
      })

      await waitForTransactionReceipt(config, {
        hash,
        confirmations: 1,
      })

      return hash
    } catch (error) {
      console.error('Error resolving market:', error)
      throw error
    }
  }

  static contractMarketToMarket(contractMarket: ContractMarket): Market {
    const{ yesTotal, noTotal, resolved, winningOutcome, createdAt, expiresAt } = contractMarket
    const totalBets = yesTotal + noTotal

    const chancePercentage = totalBets > 0
      ? Number((yesTotal * BigInt(100)) / totalBets)
      : 50

    const yesOdds = yesTotal > 0 ? Number(totalBets) / Number(yesTotal) : 2.0
    const noOdds = noTotal > 0 ? Number(totalBets) / Number(noTotal) : 2.0
    let status: MarketStatus
    if (resolved) {
      status = 'resolved'
    } else {
      const now = Date.now() / 1000
      const expiresAt = Number(contractMarket.expiresAt)
      status = expiresAt <= now ? 'finalized' : 'open'
    }

    const winningOption = resolved ? {
      id: winningOutcome ? 'yes' : 'no',
      name: winningOutcome ? 'Yes' : 'No',
      odds: winningOutcome ? yesOdds : noOdds
    } : undefined
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
      createdAt: new Date(Number(createdAt) * 1000),
      closingDate: new Date(Number(expiresAt) * 1000),
      admin: contractMarket.owner,
      winningOption: resolved ? winningOption : undefined
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


  /**
   * Get blockchain connection status for UI display
   */
  static async getConnectionStatus(): Promise<BlockchainConnectionStatus> {
    const status = await BlockchainStatusService.getStatus()
    return status.evm
  }
}