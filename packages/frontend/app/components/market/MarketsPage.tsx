'use client'

import React, { useState } from 'react'
import { MarketGrid } from './MarketGrid'
import { PlaceBetModal } from '@/components/betting'
import { Market, PlaceBetData, MarketOption } from '@/types'
import { useVault } from '@/hooks/useVault'
import { useWallet } from '@/context/WalletContext'
import { useUserMarkets } from '@/hooks/useUserMarkets'

export function MarketsPage() {
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [isBetModalOpen, setIsBetModalOpen] = useState(false)

  const { markets, activeMarkets, isLoading } = useUserMarkets()
  const { placeBet, isLoading: isPlacingBet, clearError } = useVault()
  const { wallet, connectWallet, isConnected } = useWallet()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleOptionClick = (marketId: string, option: MarketOption) => {
    const market = markets.find(m => m.id === marketId)
    if (market) {
      setSelectedMarket(market)
      setIsBetModalOpen(true)

    }
  }

  const handlePlaceBet = async (betData: PlaceBetData) => {
    try {
      clearError()

      let userAddress: string

      if (wallet?.address) {
        userAddress = wallet.address
      } else {
        userAddress = "0x279acb41a60fcce801cec69b3c7b23691e34cd3adb0149af2373acc8e08b97d2"
      }

      const outcome = betData.option === 'yes' ? 1 : 0


      const txHash = await placeBet({
        marketId: betData.marketId,
        outcome,
        amount: betData.amount,
        userAddress
      })

      alert(`Bet placed successfully! Transaction: ${txHash}`)
    } catch (error) {
      console.error('Failed to place bet:', error)
      throw error
    }
  }

  const handleCloseModal = () => {
    setIsBetModalOpen(false)
    setSelectedMarket(null)
  }

  const handleConnectWallet = async () => {
    try {
      await connectWallet('aztec')
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

  return (
    <>
      <div className="container mx-auto px-8 py-8">
        <div className="mb-8">
          <h1 className="heading-h1 mb-2">
            Prediction Markets
          </h1>
          <p className="text-muted-foreground">
            Private betting with zero-knowledge proofs on cross-chain markets
          </p>
        </div>

        <MarketGrid
          markets={activeMarkets}
          onOptionClick={handleOptionClick}
          onConnectWallet={handleConnectWallet}
          isWalletConnected={isConnected}
          isLoading={isLoading}
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

        <PlaceBetModal
          isOpen={isBetModalOpen}
          onClose={handleCloseModal}
          market={selectedMarket}
          onPlaceBet={handlePlaceBet}
          isLoading={isPlacingBet}
        />
      </div>
    </>
  )
}