import type { Market, MarketStatus, MarketOptionWithOdds } from '@/types'

/**
 * Mock data factory for offline/demo mode
 * Provides consistent, realistic data that matches real Market interfaces
 */

// Realistic market questions for demo purposes
const DEMO_QUESTIONS = [
  'Will Bitcoin reach $100,000 by end of 2024?',
  'Will AI achieve AGI by 2030?',
  'Will SpaceX land humans on Mars by 2028?',
  'Will a major tech company reach $5T market cap by 2025?',
  'Will renewable energy exceed 50% of global production by 2026?',
  'Will quantum computers break RSA encryption by 2027?',
  'Will autonomous vehicles be legal in all US states by 2025?',
  'Will a new pandemic cause global lockdowns by 2026?',
  'Will VR/AR headsets outsell smartphones by 2030?',
  'Will lab-grown meat be cheaper than regular meat by 2025?'
]

/**
 * Generate consistent mock options with realistic odds
 */
function generateMockOptions(): MarketOptionWithOdds[] {
  // Random but consistent odds that add up sensibly
  const yesChance = 0.3 + Math.random() * 0.4 // 30-70%
  const noChance = 1 - yesChance

  return [
    {
      id: 'yes',
      name: 'Yes',
      odds: Number((1 / yesChance).toFixed(2))
    },
    {
      id: 'no',
      name: 'No',
      odds: Number((1 / noChance).toFixed(2))
    }
  ]
}

/**
 * Generate a mock market with consistent data
 */
function generateMockMarket(id: string, questionIndex: number): Market {
  const question = DEMO_QUESTIONS[questionIndex % DEMO_QUESTIONS.length]
  const options = generateMockOptions()

  // Deterministic but varied dates based on ID
  const seedValue = parseInt(id.slice(-2) || '0', 16)
  const daysAgo = (seedValue % 30) + 1
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

  // Closing dates: some past, some future
  const hoursFromNow = (seedValue % 48) - 24 // -24 to +24 hours
  const closingDate = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)

  // Status based on closing date
  let status: MarketStatus
  if (closingDate.getTime() > Date.now()) {
    status = 'open'
  } else if (seedValue % 3 === 0) {
    status = 'resolved'
  } else {
    status = 'finalized'
  }

  // Calculate realistic chance percentage from odds
  const yesOdds = options.find(opt => opt.id === 'yes')?.odds || 2
  const chancePercentage = Math.round(100 / yesOdds)

  const market: Market = {
    id,
    question,
    options,
    status,
    createdAt,
    closingDate,
    chancePercentage,
    isOfflineMode: true,
    admin: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' // Demo admin address
  }

  // Add resolved fields for resolved markets
  if (status === 'resolved') {
    market.resolvedAt = new Date(closingDate.getTime() + 24 * 60 * 60 * 1000)
    market.winningOption = options[seedValue % 2] // Random winner
  }

  return market
}

/**
 * Factory class for generating consistent mock data
 */
export class MockDataFactory {
  private static readonly CACHE_KEY = 'mockMarkets'
  private static cache: Market[] | null = null

  /**
   * Get consistent set of mock markets
   * Uses sessionStorage to maintain consistency across component re-renders
   */
  static getMockMarkets(count: number = 10): Market[] {
    // Try to get from cache first
    if (this.cache) {
      return this.cache.slice(0, count)
    }

    // Try to get from sessionStorage
    try {
      const stored = sessionStorage.getItem(this.CACHE_KEY)
      if (stored) {
        const parsedMarkets = JSON.parse(stored).map((market: Market & { createdAt: string; closingDate: string; resolvedAt?: string }) => ({
          ...market,
          createdAt: new Date(market.createdAt),
          closingDate: new Date(market.closingDate),
          resolvedAt: market.resolvedAt ? new Date(market.resolvedAt) : undefined
        }))
        this.cache = parsedMarkets
        return this.cache?.slice(0, count) || []
      }
    } catch (error) {
      console.debug('Failed to load cached mock markets:', error)
    }

    // Generate new mock data
    const markets: Market[] = []
    for (let i = 0; i < count; i++) {
      const id = `mock-${i.toString().padStart(3, '0')}`
      markets.push(generateMockMarket(id, i))
    }

    // Cache in memory and sessionStorage
    this.cache = markets
    try {
      sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(markets))
    } catch (error) {
      console.debug('Failed to cache mock markets:', error)
    }

    return markets.slice(0, count)
  }

  /**
   * Get mock markets filtered by status
   */
  static getMockMarketsByStatus(status: MarketStatus, count: number = 10): Market[] {
    return this.getMockMarkets(20).filter(market => market.status === status).slice(0, count)
  }

  /**
   * Get a single mock market by ID
   */
  static getMockMarketById(id: string): Market | null {
    return this.getMockMarkets(20).find(market => market.id === id) || null
  }

  /**
   * Clear the cache (useful for testing or refreshing demo data)
   */
  static clearCache(): void {
    this.cache = null
    try {
      sessionStorage.removeItem(this.CACHE_KEY)
    } catch (error) {
      console.debug('Failed to clear mock markets cache:', error)
    }
  }

  /**
   * Simulate creating a new market
   */
  static createMockMarket(question: string, closingTime: Date): Market {
    // Get existing markets to maintain consistency
    this.getMockMarkets()
    const newId = `mock-${Date.now()}`

    const newMarket: Market = {
      id: newId,
      question,
      options: generateMockOptions(),
      status: 'open',
      createdAt: new Date(),
      closingDate: closingTime,
      chancePercentage: 50,
      isOfflineMode: true,
      admin: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
    }

    // Add to cache
    if (this.cache) {
      this.cache.unshift(newMarket)
      try {
        sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache))
      } catch (error) {
        console.debug('Failed to update cached mock markets:', error)
      }
    }

    return newMarket
  }

  /**
   * Simulate resolving a market
   */
  static resolveMockMarket(marketId: string, winningOption: 'yes' | 'no'): Market | null {
    const markets = this.getMockMarkets()
    const marketIndex = markets.findIndex(m => m.id === marketId)

    if (marketIndex === -1) return null

    const market = markets[marketIndex]
    market.status = 'resolved'
    market.resolvedAt = new Date()
    market.winningOption = market.options.find(opt => opt.id === winningOption) || null

    // Update cache
    if (this.cache) {
      this.cache[marketIndex] = market
      try {
        sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache))
      } catch (error) {
        console.debug('Failed to update cached mock markets:', error)
      }
    }

    return market
  }

  /**
   * Get mock market statistics
   */
  static getMockStats() {
    const markets = this.getMockMarkets(20)
    const openMarkets = markets.filter(m => m.status === 'open')
    const finalizedMarkets = markets.filter(m => m.status === 'finalized')
    const resolvedMarkets = markets.filter(m => m.status === 'resolved')

    return {
      totalMarkets: markets.length,
      activeMarkets: openMarkets.length,
      finalizedMarkets: finalizedMarkets.length,
      resolvedMarkets: resolvedMarkets.length,
      totalVolume: BigInt(Math.floor(Math.random() * 1000000) + 50000), // Mock volume
      averageVolume: Math.floor(Math.random() * 10000) + 2500
    }
  }
}