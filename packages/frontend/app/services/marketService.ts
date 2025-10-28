import { readContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions'
import { config } from '@/config/wagmi'
import { PREDICTION_MARKET_ABI } from '@/constants/contracts'
import { Market, MarketStatus, BlockchainConnectionStatus } from '@/types'
import { BlockchainStatusService } from './blockchainStatusService'
import { parseUnits } from 'viem'
import { vaultService } from './vault'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS as `0x${string}`
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` // Arbitrum Sepolia USDC
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS as `0x${string}`

// Minimal ERC20 ABI for approve function
const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const

export interface ContractMarket {
  id: bigint
  owner: string
  question: string
  totalPool: bigint
  yesTotal: bigint
  noTotal: bigint
  resolved: boolean
  winningOutcome: boolean
  createdAt: bigint
  expiresAt: bigint
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
      console.warn('Contract address not configured, using mock data')
    }

    try {
      console.log('Getting market count from contract:', CONTRACT_ADDRESS)
      const result = await readContract(config, {
        address: CONTRACT_ADDRESS,
        abi: PREDICTION_MARKET_ABI,
        functionName: 'getAllMarketsCount',
      })
      console.log('Market count result:', Number(result))
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
      functionName: 'getMarket',
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

  /**
   * Check USDC allowance for Treasury
   */
  static async checkUSDCAllowance(ownerAddress: string): Promise<bigint> {
    if (!TREASURY_ADDRESS) {
      throw new Error('Treasury address not configured')
    }

    try {
      const allowance = await readContract(config, {
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [ownerAddress as `0x${string}`, TREASURY_ADDRESS],
      })
      return allowance as bigint
    } catch (error) {
      console.error('Failed to check USDC allowance:', error)
      return 0n
    }
  }

  /**
   * Approve USDC for Treasury (required before creating markets)
   */
  static async approveUSDC(amount: bigint): Promise<string> {
    if (!TREASURY_ADDRESS) {
      throw new Error('Treasury address not configured')
    }

    try {
      console.log(`Approving ${amount} USDC for Treasury...`)
      const hash = await writeContract(config, {
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [TREASURY_ADDRESS, amount],
        gas: 100000n,
      })

      await waitForTransactionReceipt(config, {
        hash,
        confirmations: 1,
      })

      console.log('USDC approved:', hash)
      return hash
    } catch (error) {
      console.error('Failed to approve USDC:', error)
      throw error
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

      console.log('Creating market with question:', question, 'poolAmount:', poolAmount, 'closingTimestamp:', closingTimestamp)
      console.log('USDC amount (with 6 decimals):', usdcAmount)

      // Step 1: Check current allowance
      const currentAllowance = await this.checkUSDCAllowance(userAddress)
      console.log('Current USDC allowance:', currentAllowance)

      // Step 2: Approve USDC if needed
      if (currentAllowance < usdcAmount) {
        console.log('⚠️  Insufficient allowance. Requesting approval for', usdcAmount.toString(), 'USDC')
        // Approve the exact poolAmount needed
        await this.approveUSDC(usdcAmount)
        console.log('✅ USDC approved')
      } else {
        console.log('✅ Sufficient allowance already exists')
      }

      // Step 3: Create market (poolAmount is the market size, NOT the USDC amount)
      const hash = await writeContract(config, {
        address: CONTRACT_ADDRESS,
        abi: PREDICTION_MARKET_ABI,
        functionName: 'createMarket',
        args: [question, poolAmount, closingTimestamp],
        gas: 500000n, // Reasonable gas limit for market creation
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
        functionName: 'getMarketsByOwner',
        args: [userAddress as `0x${string}`, BigInt(0), BigInt(100)],
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
        functionName: 'getActiveMarkets',
        args: [BigInt(0), BigInt(100)],
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
        functionName: 'getMarketsByOwner',
        args: [adminAddress as `0x${string}`, BigInt(0), BigInt(100)],
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
      console.log(`Resolving market ${marketId} with winning option: ${winningOption}`)
      const winningOutcome = winningOption === 'yes'

      const hash = await writeContract(config, {
        address: CONTRACT_ADDRESS,
        abi: PREDICTION_MARKET_ABI,
        functionName: 'resolveMarket',
        args: [BigInt(marketId), winningOutcome],
        gas: 200000n, // Reasonable gas limit for market resolution
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

  // === Helper Methods ===

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


  /**
   * Claim reward for a winning bet
   *
   * This will:
   * 1. Call vaultService to authorize claim on Aztec
   * 2. Aztec verifies the secret matches the commitment
   * 3. Aztec generates nullifier and sends Wormhole message
   * 4. Wormhole relays to Arbitrum
   * 5. Arbitrum calculates payout and transfers USDC
   */
  static async claimReward(betId: string, marketId: string, recipientAddress: string): Promise<void> {
    try {
      console.log(`Claiming reward for bet ${betId} in market ${marketId}`);
      console.log(`Recipient (Aztec address): ${recipientAddress}`);

      // Call vaultService to authorize claim on Aztec
      // This will:
      // - Retrieve commitment and secret from localStorage
      // - Call BetVault.authorizeClaim() on Aztec
      // - Send Wormhole message to Arbitrum
      const txHash = await vaultService.authorizeClaim({
        marketId: marketId,
        betId: betId,
        recipient: recipientAddress, // Aztec address for claim authorization
      });

      console.log(`Claim authorization transaction sent: ${txHash}`);
      console.log('Transaction will be processed by Wormhole → Arbitrum automatically');
      console.log('Payout will be sent to the recipient address on Arbitrum');

      // Note: The actual payout happens asynchronously via Wormhole
      // The user will receive USDC on Arbitrum after:
      // 1. Wormhole guardians sign the VAA (~1-2 minutes)
      // 2. Relayer delivers message to Arbitrum
      // 3. PredictionMarketCore calculates payout
      // 4. Treasury transfers USDC to recipient
    } catch (error) {
      console.error('Error claiming reward:', error);
      throw new Error(`Failed to claim reward: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}