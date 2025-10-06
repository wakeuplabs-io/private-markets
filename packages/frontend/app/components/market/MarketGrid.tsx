"use client";

import React from "react";
import { MarketCard } from "./MarketCard";
import { cn } from "@/lib/utils";
import { Market } from "@/types";
import { EmptyState } from "@/components/ui/Fallbacks";

interface MarketGridProps {
    markets: Market[];
    onOptionClick?: (
        marketId: string,
        option: import("@/types").MarketOption
    ) => void;
    onConnectWallet?: () => void;
    isWalletConnected?: boolean;
    className?: string;
    emptyState?: React.ReactNode;
    isLoading?: boolean;
    onSelectMarket?: (market: Market) => void;
}

const MarketGrid: React.FC<MarketGridProps> = ({
    markets,
    onOptionClick,
    onConnectWallet,
    isWalletConnected,
    className,
    emptyState,
    isLoading,
    onSelectMarket,
}) => {
    if (!isLoading && markets.length === 0) {
        return (
            <div className={cn("py-16", className)}>
                {emptyState || (
                    <EmptyState
                        title="No markets available"
                        message="There are currently no prediction markets to display."
                        icon="📊"
                    />
                )}
            </div>
        );
    }

    return (
        <div
            className={cn(
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6",
                className
            )}
        >
            {isLoading ? (
                <>
                    <MarketCard isLoading={isLoading} market={null} />
                    <MarketCard isLoading={isLoading} market={null} />
                    <MarketCard isLoading={isLoading} market={null} />
                    <MarketCard isLoading={isLoading} market={null} />
                    <MarketCard isLoading={isLoading} market={null} />
                    <MarketCard isLoading={isLoading} market={null} />
                    <MarketCard isLoading={isLoading} market={null} />
                    <MarketCard isLoading={isLoading} market={null} />
                    <MarketCard isLoading={isLoading} market={null} />
                    <MarketCard isLoading={isLoading} market={null} />
                    <MarketCard isLoading={isLoading} market={null} />
                    <MarketCard isLoading={isLoading} market={null} />
                </>
            ) : (
                markets.map((market) => (
                    <MarketCard
                        isLoading={isLoading}
                        key={market.id}
                        market={market}
                        onOptionClick={onOptionClick}
                        onConnectWallet={onConnectWallet}
                        isWalletConnected={isWalletConnected}
                        onSelectMarket={onSelectMarket}
                    />
                ))
            )}
        </div>
    );
};

export { MarketGrid };
export type { MarketGridProps };
