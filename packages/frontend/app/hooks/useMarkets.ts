'use client'

import { useState, useEffect } from 'react'
import { Market, CreateMarketData } from '@/types'

interface UseMarketsReturn {
  markets: Market[]
  isLoading: boolean
  error: string | null
  refreshMarkets: () => Promise<void>
  createMarket: (data: CreateMarketData) => Promise<void>
  resolveMarket: (marketId: string, winningOption: 'yes' | 'no') => Promise<void>
}

// Mock API functions - replace with actual API calls
const mockMarkets: Market[] = [
  {
    id: '1',
    question: 'Will it rain tomorrow in Madrid?',
    description: 'Weather prediction for Madrid on the next day',
    imageUrl: 'https://images.unsplash.com/photo-1527766833261-b09c3163a791?w=48&h=48&fit=crop&crop=center',
    chancePercentage: 29,
    options: [
      { id: 'yes', name: 'Yes, it will rain', odds: 1.8 },
      { id: 'no', name: 'No, it will not rain', odds: 2.2 }
    ],
    status: 'open',
    createdAt: new Date('2024-01-15'),
    closingDate: new Date('2025-01-25T18:00:00'),
    disclaimer: 'Weather predictions are based on meteorological data'
  },
  {
    id: '2',
    question: 'Will Bitcoin reach $100,000 by end of 2025?',
    imageUrl: 'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=48&h=48&fit=crop&crop=center',
    chancePercentage: 67,
    options: [
      { id: 'yes', name: 'Yes, BTC ≥ $100k', odds: 2.1 },
      { id: 'no', name: 'No, BTC < $100k', odds: 1.7 }
    ],
    status: 'open',
    createdAt: new Date('2024-01-10'),
    closingDate: new Date('2025-12-31T23:59:59')
  },
  {
    id: '3',
    question: 'Will Ethereum reach $5,000 this year?',
    imageUrl: 'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=48&h=48&fit=crop&crop=center',
    chancePercentage: 42,
    options: [
      { id: 'yes', name: 'ETH ≥ $5k', odds: 2.4 },
      { id: 'no', name: 'ETH < $5k', odds: 1.6 }
    ],
    status: 'open',
    createdAt: new Date('2024-01-01'),
    closingDate: new Date('2025-12-20T12:00:00')
  },
  {
    id: '4',
    question: 'Will Tesla stock hit $300 by Q2 2025?',
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=48&h=48&fit=crop&crop=center',
    chancePercentage: 78,
    options: [
      { id: 'yes', name: 'TSLA ≥ $300', odds: 1.3 },
      { id: 'no', name: 'TSLA < $300', odds: 3.7 }
    ],
    status: 'open',
    createdAt: new Date('2024-01-05'),
    closingDate: new Date('2025-06-30T23:59:59')
  }
]

const fetchMarkets = async (): Promise<Market[]> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))
  return mockMarkets
}

const apiCreateMarket = async (data: CreateMarketData): Promise<Market> => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1500))

  const newMarket: Market = {
    id: Date.now().toString(),
    question: data.question,
    options: [
      { id: 'yes', name: data.optionYes, odds: 2.0 },
      { id: 'no', name: data.optionNo, odds: 2.0 }
    ],
    status: 'open',
    createdAt: new Date(),
    closingDate: data.closingDate,
    disclaimer: data.disclaimer
  }

  return newMarket
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const apiResolveMarket = async (marketId: string, winningOption: 'yes' | 'no'): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 1500))
}

export function useMarkets(): UseMarketsReturn {
  const [markets, setMarkets] = useState<Market[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshMarkets = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const fetchedMarkets = await fetchMarkets()
      setMarkets(fetchedMarkets)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch markets')
    } finally {
      setIsLoading(false)
    }
  }

  const createMarket = async (data: CreateMarketData) => {
    try {
      const newMarket = await apiCreateMarket(data)
      setMarkets(prev => [newMarket, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create market')
      throw err
    }
  }

  const resolveMarket = async (marketId: string, winningOption: 'yes' | 'no') => {
    try {
      await apiResolveMarket(marketId, winningOption);

      setMarkets(prev =>
        prev.map(market =>
          market.id === marketId
            ? {
                ...market,
                status: 'resolved' as const,
                winningOption: market.options.find(option => option.id === winningOption),
                resolvedAt: new Date()
              }
            : market
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve market');
      throw err;
    }
  }

  // Load markets on mount
  useEffect(() => {
    refreshMarkets()
  }, [])

  return {
    markets,
    isLoading,
    error,
    refreshMarkets,
    createMarket,
    resolveMarket
  }
}