import { readContract } from 'wagmi/actions'
import { config } from '@/config/wagmi'
import { PREDICTION_MARKET_ABI } from '@/constants/contracts'
import type { BlockchainConnectionStatus } from '@/types'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS as `0x${string}`
const PXE_URL = process.env.NEXT_PUBLIC_PXE_URL || 'http://localhost:8080'

interface BlockchainStatus {
  evm: BlockchainConnectionStatus
  aztec: BlockchainConnectionStatus
  lastChecked: number
}

/**
 * Service for checking blockchain connectivity status
 * Provides caching and health checks for both EVM and Aztec networks
 */
export class BlockchainStatusService {
  private static cache: BlockchainStatus = {
    evm: 'connecting',
    aztec: 'connecting',
    lastChecked: 0
  }

  private static readonly CACHE_DURATION = 30000 // 30 seconds
  private static readonly CHECK_TIMEOUT = 5000 // 5 seconds

  /**
   * Get current blockchain status with caching
   */
  static async getStatus(): Promise<BlockchainStatus> {
    const now = Date.now()

    // Return cached status if still valid
    if (now - this.cache.lastChecked < this.CACHE_DURATION) {
      return { ...this.cache }
    }

    // Update cache with new checks
    const [evmStatus, aztecStatus] = await Promise.all([
      this.checkEVMStatus(),
      this.checkAztecStatus()
    ])

    this.cache = {
      evm: evmStatus,
      aztec: aztecStatus,
      lastChecked: now
    }

    return { ...this.cache }
  }

  /**
   * Force refresh status bypassing cache
   */
  static async refreshStatus(): Promise<BlockchainStatus> {
    this.cache.lastChecked = 0
    return this.getStatus()
  }

  /**
   * Check if EVM blockchain is accessible
   */
  private static async checkEVMStatus(): Promise<BlockchainConnectionStatus> {
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return 'error'
    }

    try {
      // Try a simple contract read with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.CHECK_TIMEOUT)

      await readContract(config, {
        address: CONTRACT_ADDRESS,
        abi: PREDICTION_MARKET_ABI,
        functionName: 'getMarketCount',
      })

      clearTimeout(timeoutId)
      return 'online'
    } catch (error) {
      console.debug('EVM blockchain check failed:', error instanceof Error ? error.message : 'Unknown error')
      return 'offline'
    }
  }

  /**
   * Check if Aztec PXE is accessible
   */
  private static async checkAztecStatus(): Promise<BlockchainConnectionStatus> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.CHECK_TIMEOUT)

      // Simple HTTP check to PXE endpoint
      const response = await fetch(`${PXE_URL}/status`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      clearTimeout(timeoutId)
      return response.ok ? 'online' : 'offline'
    } catch (error) {
      console.debug('Aztec PXE check failed:', error instanceof Error ? error.message : 'Unknown error')
      return 'offline'
    }
  }

  /**
   * Check if at least one blockchain is online
   */
  static async isAnyBlockchainOnline(): Promise<boolean> {
    const status = await this.getStatus()
    return status.evm === 'online' || status.aztec === 'online'
  }

  /**
   * Check if EVM specifically is online (for market operations)
   */
  static async isEVMOnline(): Promise<boolean> {
    const status = await this.getStatus()
    return status.evm === 'online'
  }

  /**
   * Check if Aztec specifically is online (for private operations)
   */
  static async isAztecOnline(): Promise<boolean> {
    const status = await this.getStatus()
    return status.aztec === 'online'
  }

  /**
   * Get a user-friendly status message
   */
  static getStatusMessage(status: BlockchainStatus): string {
    if (status.evm === 'online' && status.aztec === 'online') {
      return 'All networks online'
    }

    if (status.evm === 'online' && status.aztec === 'offline') {
      return 'Markets available (private betting unavailable)'
    }

    if (status.evm === 'offline' && status.aztec === 'online') {
      return 'Private operations available (markets unavailable)'
    }

    if (status.evm === 'offline' && status.aztec === 'offline') {
      return 'All networks offline - using demo data'
    }

    return 'Checking network status...'
  }

  /**
   * Clear the cache (useful for testing)
   */
  static clearCache(): void {
    this.cache.lastChecked = 0
  }
}