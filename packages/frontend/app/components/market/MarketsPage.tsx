"use client";

import React, { useState } from "react";
import { MarketGrid } from "./MarketGrid";
import { PlaceBetModal } from "@/components/betting";
import { Market, PlaceBetData, MarketOption } from "@/types";
import { useVault } from "@/hooks/useVault";
import { useWallet } from "@/context/WalletContext";
import { useUserMarkets } from "@/hooks/useUserMarkets";
import { MarketDetailModal } from "./MarketDetailModal";
import { EmptyState } from "@/components/ui/Fallbacks";
import Image from "next/image";

const MarketsEmptyState = () => {
    return (
        <EmptyState
            title="No markets available"
            message="There are currently no prediction markets available. New markets will appear here when they're created."
            icon={
                <Image
                    src="/search.svg"
                    alt="No prediction markets"
                    width={36}
                    height={36}
                />
            }
        />
    );
};

export function MarketsPage() {
    const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
    const [isBetModalOpen, setIsBetModalOpen] = useState(false);

    const { activeMarkets, isLoading } = useUserMarkets();
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const { placeBet, isLoading: isPlacingBet, clearError } = useVault();
    const { wallet, connectWallet, isConnected } = useWallet();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleOptionClick = (marketId: string, option: MarketOption) => {
        const market = activeMarkets.find((m) => m.id === marketId);
        if (market) {
            setSelectedMarket(market);
            setIsBetModalOpen(true);
        }
    };

    const handlePlaceBet = async (betData: PlaceBetData) => {
        try {
            clearError();

            let userAddress: string;

            if (wallet?.address) {
                userAddress = wallet.address;
            } else {
                userAddress =
                    "0x279acb41a60fcce801cec69b3c7b23691e34cd3adb0149af2373acc8e08b97d2";
            }

            const outcome = betData.option === "yes" ? 1 : 0;

            const txHash = await placeBet({
                marketId: betData.marketId,
                outcome,
                amount: betData.amount,
                userAddress,
            });

            alert(`Bet placed successfully! Transaction: ${txHash}`);
        } catch (error) {
            console.error("Failed to place bet:", error);
            throw error;
        }
    };

    const handleCloseModal = () => {
        setIsBetModalOpen(false);
        setSelectedMarket(null);
    };

    const handleConnectWallet = async () => {
        try {
            await connectWallet("aztec");
        } catch (error) {
            console.error("Failed to connect wallet:", error);
        }
    };

    const handleSelectMarket = (market: Market) => {
        console.log("handleSelectMarket", market);
        setSelectedMarket(market);
        setIsDetailModalOpen(true);
    };

    return (
        <>
            <div className="container py-8">
                <div className="mb-8">
                    <h1 className="heading-h1 mb-2">Prediction Markets</h1>
                    <p className="text-muted-foreground">
                        Private betting with zero-knowledge proofs on
                        cross-chain markets
                    </p>
                </div>

                <MarketGrid
                    markets={activeMarkets}
                    onOptionClick={handleOptionClick}
                    onConnectWallet={handleConnectWallet}
                    isWalletConnected={isConnected}
                    isLoading={isLoading}
                    onSelectMarket={handleSelectMarket}
                    emptyState={<MarketsEmptyState />}
                />
                <MarketDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    onBack={() => setIsDetailModalOpen(false)}
                    market={selectedMarket}
                    bets={null}
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
    );
}
