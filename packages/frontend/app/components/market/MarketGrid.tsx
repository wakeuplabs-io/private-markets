"use client";

import React from "react";
import { MarketCard } from "./MarketCard";
import { cn } from "@/lib/utils";
import { Market } from "@/types";

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
}

const MarketGrid: React.FC<MarketGridProps> = ({
    markets,
    onOptionClick,
    onConnectWallet,
    isWalletConnected,
    className,
    emptyState,
    isLoading,
}) => {
    if (!isLoading && markets.length === 0) {
        return (
            <div className={cn("py-16", className)}>
                {emptyState || (
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                            <span className="text-2xl">📊</span>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-foreground">
                                No markets available
                            </h3>
                            <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                There are currently no prediction markets to
                                display.
                            </p>
                        </div>
                    </div>
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
                    />
                ))
            )}
        </div>
    );
};

export { MarketGrid };
export type { MarketGridProps };
