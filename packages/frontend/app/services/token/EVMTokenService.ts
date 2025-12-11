import { readContract, writeContract, waitForTransactionReceipt } from 'wagmi/actions'
import { config } from '@/config/wagmi'
import { ERC20_ABI } from '@/constants/abis'

/**
 * EVM Token Information
 * Metadata for ERC20 tokens on EVM chains (e.g., Arbitrum)
 */
export interface EVMTokenInfo {
  name: string
  symbol: string
  decimals: number
  address: `0x${string}`
}


export class EVMTokenService {
  private static instance: EVMTokenService

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): EVMTokenService {
    if (!EVMTokenService.instance) {
      EVMTokenService.instance = new EVMTokenService()
    }
    return EVMTokenService.instance
  }

  /**
   * Get token balance for an address
   *
   * @param tokenAddress - ERC20 token contract address
   * @param ownerAddress - Address to check balance for
   * @returns Token balance as bigint (in token's native decimals)
   *
   * @example
   * ```typescript
   * // Token balance (18 decimals)
   * const balance = await evmTokenService.getBalance(
   *   tokenAddress,
   *   userAddress
   * )
   * // balance = 1000000000000000000n represents 1.0 token
   * ```
   */
  async getBalance(tokenAddress: `0x${string}`, ownerAddress: `0x${string}`): Promise<bigint> {
    try {
      const balance = await readContract(config, {
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [ownerAddress],
      })

      return balance as bigint
    } catch (error) {
      console.error('Failed to get token balance:', error)
      throw new Error(`Failed to get token balance: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check token allowance
   *
   * @param tokenAddress - ERC20 token contract address
   * @param ownerAddress - Token owner address
   * @param spenderAddress - Address allowed to spend tokens
   * @returns Approved amount as bigint
   *
   * @example
   * ```typescript
   * const allowance = await evmTokenService.checkAllowance(
   *   usdcAddress,
   *   userAddress,
   *   treasuryAddress
   * )
   * ```
   */
  async checkAllowance(
    tokenAddress: `0x${string}`,
    ownerAddress: `0x${string}`,
    spenderAddress: `0x${string}`
  ): Promise<bigint> {
    try {
      const allowance = await readContract(config, {
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [ownerAddress, spenderAddress],
      })

      return allowance as bigint
    } catch (error) {
      console.error('Failed to check allowance:', error)
      return 0n
    }
  }

  /**
   * Approve token spending
   *
   * @param tokenAddress - ERC20 token contract address
   * @param spenderAddress - Address to approve for spending
   * @param amount - Amount to approve (in token's native decimals)
   * @returns Transaction hash
   *
   * @example
   * ```typescript
   * // Approve Treasury to spend 100 tokens (18 decimals)
   * const hash = await evmTokenService.approve(
   *   tokenAddress,
   *   treasuryAddress,
   *   100000000000000000000n // 100 tokens with 18 decimals
   * )
   * ```
   */
  async approve(
    tokenAddress: `0x${string}`,
    spenderAddress: `0x${string}`,
    amount: bigint
  ): Promise<string> {
    try {
      const hash = await writeContract(config, {
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, amount],
      })

      await waitForTransactionReceipt(config, {
        hash,
        confirmations: 1,
      })

      return hash
    } catch (error) {
      console.error('Failed to approve tokens:', error)
      throw error
    }
  }

  async getTokenInfo(tokenAddress: `0x${string}`): Promise<EVMTokenInfo> {
    try {
      // Fetch all metadata in parallel
      const [name, symbol, decimals] = await Promise.all([
        readContract(config, {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'name',
        }),
        readContract(config, {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }),
        readContract(config, {
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }),
      ])

      return {
        name: name as string,
        symbol: symbol as string,
        decimals: Number(decimals),
        address: tokenAddress,
      }
    } catch (error) {
      console.error('Failed to get token info:', error)
      throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }


  formatBalance(balance: bigint, decimals: number, maxDecimals: number = 2): string {
    const divisor = BigInt(10 ** decimals)
    const integerPart = balance / divisor
    const fractionalPart = balance % divisor

    if (fractionalPart === BigInt(0)) {
      return integerPart.toString()
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
    const limitedFractional = fractionalStr.slice(0, maxDecimals)
    const trimmedFractional = limitedFractional.replace(/0+$/, '')

    if (trimmedFractional === '') {
      return integerPart.toString()
    }

    return `${integerPart}.${trimmedFractional}`
  }
}

/**
 * Singleton instance export
 * Import this in your application code
 */
export const evmTokenService = EVMTokenService.getInstance()

/**
 * Default export for convenience
 */
export default evmTokenService
