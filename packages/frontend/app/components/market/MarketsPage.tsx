"use client";

import React, { useState } from "react";
import { MarketGrid } from "./MarketGrid";
import { PlaceBetModal, BetSuccessModal } from "@/components/betting";
import { Market, PlaceBetData, MarketOption } from "@/types";
import { useVault } from "@/hooks/useVault";
import { useWallet } from "@/context/WalletContext";
import { useUserMarkets } from "@/hooks/useUserMarkets";
import { EmptyState } from "@/components/ui/Fallbacks";
import { NetworkMismatchAlert } from "@/components/ui/NetworkMismatchAlert";
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
    const [selectedOption, setSelectedOption] = useState<MarketOption | null>(null);

    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successBetData, setSuccessBetData] = useState<{
        market: Market;
        option: MarketOption;
        amount: number;
        txHash?: string;
    } | null>(null);

    const { activeMarkets, isLoading } = useUserMarkets();
    const { placeBet, clearError } = useVault();
    const { wallet, connectWallet, isConnected } = useWallet();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleOptionClick = (marketId: string, option: MarketOption) => {
        const market = activeMarkets.find((m) => m.id === marketId);
        if (market) {
            setSelectedMarket(market);
            setSelectedOption(option);
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

            const outcome = betData.option === "yes" ? 3 : 2;

            const txHash = await placeBet({
                marketId: betData.marketId,
                outcome,
                amount: betData.amount,
                userAddress,
            });

            setIsBetModalOpen(false);

            if (selectedMarket) {
                setSuccessBetData({
                    market: selectedMarket,
                    option: betData.option,
                    amount: betData.amount,
                    txHash,
                });
                setIsSuccessModalOpen(true);
            }
        } catch (error) {
            console.error("Failed to place bet:", error);
            throw error;
        }
    };

    const handleCloseModal = () => {
        setIsBetModalOpen(false);
        setSelectedMarket(null);
        setSelectedOption(null);
    };

    const handleCloseSuccessModal = () => {
        setIsSuccessModalOpen(false);
        setSuccessBetData(null);
        setSelectedMarket(null);
        setSelectedOption(null);
    };

    const handleConnectWallet = async () => {
        try {
            await connectWallet("aztec");
        } catch (error) {
            console.error("Failed to connect wallet:", error);
        }
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

                <NetworkMismatchAlert className="mb-6" />

                <MarketGrid
                    markets={activeMarkets}
                    onOptionClick={handleOptionClick}
                    onConnectWallet={handleConnectWallet}
                    isWalletConnected={isConnected}
                    isLoading={isLoading}
                    emptyState={<MarketsEmptyState />}
                />
                <PlaceBetModal
                    isOpen={isBetModalOpen}
                    onClose={handleCloseModal}
                    market={selectedMarket}
                    selectedOption={selectedOption}
                    onPlaceBet={handlePlaceBet}
                />
                <BetSuccessModal
                    isOpen={isSuccessModalOpen}
                    onClose={handleCloseSuccessModal}
                    market={successBetData?.market ?? null}
                    selectedOption={successBetData?.option ?? null}
                    amount={successBetData?.amount ?? 0}
                    txHash={successBetData?.txHash}
                />
            </div>
        </>
    );
}
