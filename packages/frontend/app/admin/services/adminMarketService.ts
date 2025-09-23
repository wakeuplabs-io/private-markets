import { 
  AdminMarket, 
  CreateMarketFormData, 
  MarketResolutionData,
  CreateMarketResponse,
  ResolveMarketResponse,
  AdminMarketFilters 
} from '@/types'

const handleApiError = (error: unknown): never => {
  console.error('Admin API Error:', error)
  if (error && typeof error === 'object' && 'response' in error) {
    const apiError = error as { response?: { data?: { message?: string } } }
    if (apiError.response?.data?.message) {
      throw new Error(apiError.response.data.message)
    }
  }
  if (error instanceof Error && error.message) {
    throw new Error(error.message)
  }
  throw new Error('An unexpected error occurred')
}

const simulateApiDelay = (ms: number = 1000): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Admin Market Service - Handles all API operations for market administration
 */
export class AdminMarketService {
  /**
   * Fetches all markets with admin-specific data
   */
  static async getMarkets(filters?: AdminMarketFilters): Promise<AdminMarket[]> {
    try {
      await simulateApiDelay(800)

      const mockMarkets = await this.getMockMarkets()
      let filteredMarkets = mockMarkets

      if (filters?.status && filters.status.length > 0) {
        filteredMarkets = filteredMarkets.filter(market =>
          filters.status!.includes(market.status)
        )
      }

      if (filters?.dateRange) {
        const { from, to } = filters.dateRange
        filteredMarkets = filteredMarkets.filter(market => {
          const marketDate = new Date(market.createdAt)
          return marketDate >= from && marketDate <= to
        })
      }

      if (filters?.sortBy) {
        filteredMarkets.sort((a, b) => {
          let aValue, bValue

          switch (filters.sortBy) {
            case 'createdAt':
              aValue = new Date(a.createdAt).getTime()
              bValue = new Date(b.createdAt).getTime()
              break
            case 'closingDate':
              aValue = new Date(a.closingDate).getTime()
              bValue = new Date(b.closingDate).getTime()
              break
            case 'volume':
              aValue = a.bets.totalVolume
              bValue = b.bets.totalVolume
              break
            case 'engagement':
              aValue = a.performance.engagement
              bValue = b.performance.engagement
              break
            default:
              return 0
          }

          return filters.sortOrder === 'desc' ? bValue - aValue : aValue - bValue
        })
      }

      return filteredMarkets
    } catch (error) {
      return handleApiError(error)
    }
  }

  /**
   * Creates a new market
   */
  static async createMarket(formData: CreateMarketFormData): Promise<CreateMarketResponse> {
    try {
      await simulateApiDelay(2000)

      const newMarket: AdminMarket = {
        id: `market_${Date.now()}`,
        question: formData.question,
        description: formData.disclaimer || '',
        options: [
          { id: 'yes', name: formData.optionYes, odds: 2.0 },
          { id: 'no', name: formData.optionNo, odds: 2.0 }
        ],
        status: 'draft',
        createdAt: new Date(),
        closingDate: formData.closingDate,
        resolvedAt: null,
        winningOption: null,
        disclaimer: formData.disclaimer,
        adminActions: {
          canResolve: false,
          canEdit: true,
          canDelete: true
        },
        bets: {
          total: 0,
          yesCount: 0,
          noCount: 0,
          totalVolume: 0
        },
        performance: {
          views: 0,
          engagement: 0
        }
      }

      return {
        success: true,
        market: newMarket
      }
    } catch (error) {
      return handleApiError(error)
    }
  }

  /**
   * Resolves a market with the winning option
   */
  static async resolveMarket(resolutionData: MarketResolutionData): Promise<ResolveMarketResponse> {
    try {
      await simulateApiDelay(1500)

      const markets = await this.getMockMarkets()
      const market = markets.find(m => m.id === resolutionData.marketId)
      const winningOptionWithOdds = market?.options.find(opt => opt.id === resolutionData.winningOption)

      return {
        success: true,
        marketId: resolutionData.marketId,
        winningOption: winningOptionWithOdds || {
          id: resolutionData.winningOption,
          name: resolutionData.winningOption === 'yes' ? 'Yes' : 'No',
          odds: 1.0
        }
      }
    } catch (error) {
      return handleApiError(error)
    }
  }

  static async updateMarket(
    marketId: string,
    updates: Partial<CreateMarketFormData>
  ): Promise<AdminMarket> {
    try {
      await simulateApiDelay(1200)

      const markets = await this.getMockMarkets()
      const market = markets.find(m => m.id === marketId)

      if (!market) {
        throw new Error('Market not found')
      }

      return {
        ...market,
        question: updates.question || market.question,
        options: [
          { id: 'yes', name: updates.optionYes || market.options[0].name, odds: market.options[0].odds },
          { id: 'no', name: updates.optionNo || market.options[1].name, odds: market.options[1].odds }
        ],
        closingDate: updates.closingDate || market.closingDate,
        description: updates.disclaimer || market.description,
        disclaimer: updates.disclaimer || market.disclaimer
      }
    } catch (error) {
      return handleApiError(error)
    }
  }

  static async activateMarket(marketId: string): Promise<AdminMarket> {
    try {
      await simulateApiDelay(800)

      const markets = await this.getMockMarkets()
      const market = markets.find(m => m.id === marketId)

      if (!market) {
        throw new Error('Market not found')
      }

      return {
        ...market,
        status: 'active',
        adminActions: {
          ...market.adminActions,
          canResolve: true
        }
      }
    } catch (error) {
      return handleApiError(error)
    }
  }

  /**
   * Gets market statistics for the admin dashboard
   */
  static async getMarketStats(): Promise<{
    totalMarkets: number
    activeMarkets: number
    draftMarkets: number
    resolvedMarkets: number
    totalVolume: number
    totalBets: number
  }> {
    try {
      await simulateApiDelay(500)

      const markets = await this.getMockMarkets()

      return {
        totalMarkets: markets.length,
        activeMarkets: markets.filter(m => m.status === 'active').length,
        draftMarkets: markets.filter(m => m.status === 'draft').length,
        resolvedMarkets: markets.filter(m => m.status === 'resolved').length,
        totalVolume: markets.reduce((sum, m) => sum + m.bets.totalVolume, 0),
        totalBets: markets.reduce((sum, m) => sum + m.bets.total, 0)
      }
    } catch (error) {
      return handleApiError(error)
    }
  }

  private static async getMockMarkets(): Promise<AdminMarket[]> {
    return [
      {
        id: '1',
        question: 'Will Bitcoin reach $100,000 before December 31, 2024?',
        description: 'Market about Bitcoin price by end of year',
        options: [
          { id: 'yes', name: 'Yes', odds: 1.8 },
          { id: 'no', name: 'No', odds: 2.1 }
        ],
        status: 'active',
        createdAt: new Date('2024-01-15'),
        closingDate: new Date('2024-12-31'),
        resolvedAt: null,
        winningOption: null,
        disclaimer: 'Market based on official Bitcoin price on major exchanges',
        adminActions: {
          canResolve: true,
          canEdit: true,
          canDelete: false
        },
        bets: {
          total: 156,
          yesCount: 89,
          noCount: 67,
          totalVolume: 45230.50
        },
        performance: {
          views: 2847,
          engagement: 0.68
        }
      },
      {
        id: '2',
        question: 'Will there be early presidential elections in Argentina in 2024?',
        description: 'Market about the possibility of early elections',
        options: [
          { id: 'yes', name: 'Yes', odds: 3.2 },
          { id: 'no', name: 'No', odds: 1.4 }
        ],
        status: 'draft',
        createdAt: new Date('2024-02-01'),
        closingDate: new Date('2024-12-31'),
        resolvedAt: null,
        winningOption: null,
        disclaimer: 'Market based on official government announcements',
        adminActions: {
          canResolve: false,
          canEdit: true,
          canDelete: true
        },
        bets: {
          total: 23,
          yesCount: 8,
          noCount: 15,
          totalVolume: 12580.25
        },
        performance: {
          views: 892,
          engagement: 0.32
        }
      },
      {
        id: '3',
        question: 'Will Tesla launch a car model under $25,000 in 2024?',
        description: 'Market about Tesla\'s new affordable model',
        options: [
          { id: 'yes', name: 'Yes', odds: 2.5 },
          { id: 'no', name: 'No', odds: 1.6 }
        ],
        status: 'resolved',
        createdAt: new Date('2024-01-01'),
        closingDate: new Date('2024-06-30'),
        resolvedAt: new Date('2024-07-01'),
        winningOption: { id: 'no', name: 'No', odds: 1.6 },
        disclaimer: 'This market resolves based on official Tesla announcements',
        adminActions: {
          canResolve: false,
          canEdit: false,
          canDelete: false
        },
        bets: {
          total: 342,
          yesCount: 158,
          noCount: 184,
          totalVolume: 78920.75
        },
        performance: {
          views: 5420,
          engagement: 0.89
        }
      }
    ]
  }
}

export default AdminMarketService