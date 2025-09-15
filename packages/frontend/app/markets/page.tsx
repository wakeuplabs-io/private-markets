'use client'

import React, { useState, useEffect } from 'react'
import { Layout } from '@/components/layout'
import { MarketGrid } from '@/components/market'
import { PlaceBetModal } from '@/components/betting'
import { Market, PlaceBetData, MarketOption } from '@/types'

// Mock data for development - replace with real API calls
const mockMarkets: Market[] = [
  {
    id: '1',
    marketId: 'market_001',
    question: 'Will it rain tomorrow in Madrid?',
    description: 'Weather prediction for Madrid on the next day',
    imageUrl: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=48&h=48&fit=crop&crop=center',
    chancePercentage: 29,
    options: {
      yes: 'Yes, it will rain',
      no: 'No, it will not rain'
    },
    status: 'open',
    createdAt: new Date('2024-01-15'),
    closingDate: new Date('2025-01-25T18:00:00'),
    disclaimer: 'Weather predictions are based on meteorological data'
  },
  {
    id: '2',
    marketId: 'market_002',
    question: 'Will Bitcoin reach $100,000 by end of 2025?',
    imageUrl: 'https://images.unsplash.com/photo-1518544866330-4e3cd1eaa959?w=48&h=48&fit=crop&crop=center',
    chancePercentage: 67,
    options: {
      yes: 'Yes, BTC ≥ $100k',
      no: 'No, BTC < $100k'
    },
    status: 'open',
    createdAt: new Date('2024-01-10'),
    closingDate: new Date('2025-12-31T23:59:59')
  },
  {
    id: '3',
    marketId: 'market_003',
    question: 'Will Ethereum reach $5,000 this year?',
    imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=48&h=48&fit=crop&crop=center',
    chancePercentage: 42,
    options: {
      yes: 'ETH ≥ $5k',
      no: 'ETH < $5k'
    },
    status: 'open',
    createdAt: new Date('2024-01-01'),
    closingDate: new Date('2025-12-20T12:00:00')
  },
  {
    id: '4',
    marketId: 'market_004',
    question: 'Will Tesla stock hit $300 by Q2 2025?',
    imageUrl: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=48&h=48&fit=crop&crop=center',
    chancePercentage: 78,
    options: {
      yes: 'TSLA ≥ $300',
      no: 'TSLA < $300'
    },
    status: 'open',
    createdAt: new Date('2024-01-05'),
    closingDate: new Date('2025-06-30T23:59:59')
  }
]

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [isBetModalOpen, setIsBetModalOpen] = useState(false)
  const [isPlacingBet, setIsPlacingBet] = useState(false)

  // Load markets on component mount
  useEffect(() => {
    const loadMarkets = async () => {
      setIsLoading(true)
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        setMarkets(mockMarkets)
      } catch (error) {
        console.error('Failed to load markets:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadMarkets()
  }, [])

  const handleOptionClick = (marketId: string, option: MarketOption) => {
    const market = markets.find(m => m.id === marketId)
    if (market) {
      setSelectedMarket(market)
      setIsBetModalOpen(true)

      // Here you could pre-set the option in the modal
      console.log(`Selected ${option} for market ${marketId}`)
    }
  }

  const handlePlaceBet = async (betData: PlaceBetData) => {
    setIsPlacingBet(true)
    try {
      // Simulate bet placement
      await new Promise(resolve => setTimeout(resolve, 2000))

      console.log('Bet placed:', betData)

      // Here you would integrate with the actual zkPassport flow
      // and cross-chain transaction logic

      alert(`Bet placed successfully! Market: ${betData.marketId}, Option: ${betData.option}, Amount: ${betData.amount} USDC`)
    } catch (error) {
      console.error('Failed to place bet:', error)
      throw error
    } finally {
      setIsPlacingBet(false)
    }
  }

  const handleCloseModal = () => {
    setIsBetModalOpen(false)
    setSelectedMarket(null)
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-8 py-16">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground">Loading markets...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="container mx-auto px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Prediction Markets
          </h1>
          <p className="text-muted-foreground">
            Private betting with zero-knowledge proofs on cross-chain markets
          </p>
        </div>

        {/* Markets Grid */}
        <MarketGrid
          markets={markets}
          onOptionClick={handleOptionClick}
          emptyState={
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">
                  No prediction markets yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Be the first to create a prediction market and start collecting private bets!
                </p>
              </div>
            </div>
          }
        />

        {/* Place Bet Modal */}
        <PlaceBetModal
          isOpen={isBetModalOpen}
          onClose={handleCloseModal}
          market={selectedMarket}
          onPlaceBet={handlePlaceBet}
          isLoading={isPlacingBet}
        />
      </div>
    </Layout>
  )
}