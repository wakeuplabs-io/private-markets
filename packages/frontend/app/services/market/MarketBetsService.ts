/**
 * Market Bets Service
 *
 * Fetches and caches BetProcessed events from the PredictionMarketCore contract.
 * Used to display bet history for specific markets.
 */

import { getPublicClient } from 'wagmi/actions'
import { config } from '@/config/wagmi'
import { ProcessedBet, ProcessedBetStats } from '@/types'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS as `0x${string}`

// BetProcessed event ABI for getLogs
const BET_PROCESSED_EVENT = {
  type: 'event',
  name: 'BetProcessed',
  inputs: [
    { name: 'marketId', type: 'uint256', indexed: true, internalType: 'uint256' },
    { name: 'betId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
    { name: 'outcome', type: 'bool', indexed: false, internalType: 'bool' },
    { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
  ],
} as const

// Cache structure: marketId -> { bets, lastBlock }
const betsCache = new Map<string, { bets: ProcessedBet[], lastBlock: bigint }>()

export class MarketBetsService {
  /**
   * Get all processed bets for a specific market
   * Uses incremental caching to avoid re-fetching old blocks
   *
   * @param marketId - The market ID to fetch bets for
   * @param fromBlock - Optional starting block (defaults to 0)
   * @returns Array of ProcessedBet objects
   */
  static async getMarketBets(marketId: string, fromBlock?: bigint): Promise<ProcessedBet[]> {
    if (!CONTRACT_ADDRESS) {
      console.warn('[MarketBetsService] Contract address not configured')
      return []
    }

    const client = getPublicClient(config, { chainId: 421614 })
    if (!client) {
      throw new Error('Failed to get public client for Arbitrum Sepolia')
    }

    // Check cache
    const cached = betsCache.get(marketId)
    const currentBlock = await client.getBlockNumber()

    // If cache is up to date, return cached bets
    if (cached && cached.lastBlock >= currentBlock) {
      return cached.bets
    }

    // Calculate start block: either from cache or provided fromBlock
    const startBlock = cached ? cached.lastBlock + 1n : (fromBlock ?? 0n)

    try {
      const logs = await client.getLogs({
        address: CONTRACT_ADDRESS,
        event: BET_PROCESSED_EVENT,
        args: {
          marketId: BigInt(marketId),
        },
        fromBlock: startBlock,
        toBlock: 'latest',
      })

      const newBets: ProcessedBet[] = logs.map((log) => ({
        marketId: marketId,
        betId: log.args.betId as string,
        outcome: log.args.outcome as boolean,
        amount: log.args.amount as bigint,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      }))

      // Merge with cached bets
      const allBets = cached ? [...cached.bets, ...newBets] : newBets

      // Update cache
      betsCache.set(marketId, { bets: allBets, lastBlock: currentBlock })

      return allBets
    } catch (error) {
      console.error('[MarketBetsService] Error fetching market bets:', error)
      // Return cached bets if available, otherwise empty array
      return cached?.bets ?? []
    }
  }

  /**
   * Calculate statistics from an array of processed bets
   *
   * @param bets - Array of ProcessedBet objects
   * @returns ProcessedBetStats object with aggregated data
   */
  static calculateBetStats(bets: ProcessedBet[]): ProcessedBetStats {
    const totalBets = bets.length
    const yesBets = bets.filter((b) => b.outcome === true)
    const noBets = bets.filter((b) => b.outcome === false)

    const totalYesAmount = yesBets.reduce((sum, b) => sum + b.amount, 0n)
    const totalNoAmount = noBets.reduce((sum, b) => sum + b.amount, 0n)
    const totalAmount = totalYesAmount + totalNoAmount

    return {
      totalBets,
      yesBetsCount: yesBets.length,
      noBetsCount: noBets.length,
      totalYesAmount,
      totalNoAmount,
      totalAmount,
      yesPercentage: totalAmount > 0n ? Number((totalYesAmount * 100n) / totalAmount) : 50,
    }
  }

  /**
   * Format bet amount for display (18 decimals for the token)
   * Shows up to 6 significant decimal places, trimming trailing zeros
   *
   * @param amount - Raw amount in smallest units (18 decimals)
   * @param decimals - Token decimals (default 18)
   * @returns Formatted string
   */
  static formatBetAmount(amount: bigint, decimals: number = 18): string {
    if (amount === 0n) return '0'

    const divisor = BigInt(10 ** decimals)
    const integerPart = amount / divisor
    const fractionalPart = amount % divisor

    // Convert fractional part to string with leading zeros preserved
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0')

    // Trim trailing zeros
    const trimmedFractional = fractionalStr.replace(/0+$/, '')

    if (trimmedFractional.length === 0) {
      return integerPart.toLocaleString('en-US')
    }

    // For display, show the fractional part (up to 6 significant digits after first non-zero)
    // Find first non-zero digit position
    const firstNonZero = trimmedFractional.search(/[1-9]/)
    if (firstNonZero === -1) {
      return integerPart.toLocaleString('en-US')
    }

    // Take leading zeros + up to 6 significant digits
    const significantPart = trimmedFractional.slice(0, firstNonZero + 6).replace(/0+$/, '')

    return `${integerPart.toLocaleString('en-US')}.${significantPart}`
  }

  /**
   * Clear cache for a specific market or all markets
   *
   * @param marketId - Optional market ID to clear specific cache
   */
  static clearCache(marketId?: string): void {
    if (marketId) {
      betsCache.delete(marketId)
    } else {
      betsCache.clear()
    }
  }

  /**
   * Check if a market has cached data
   *
   * @param marketId - Market ID to check
   * @returns boolean indicating if cache exists
   */
  static hasCachedData(marketId: string): boolean {
    return betsCache.has(marketId)
  }
}
