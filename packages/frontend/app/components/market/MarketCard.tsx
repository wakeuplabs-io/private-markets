"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import {
    SafeRender,
    InvalidDataState,
    MarketCardSkeleton,
} from "@/components/ui/Fallbacks";
import { cn } from "@/lib/utils";
import { Market, MarketOption } from "@/types";
import {
    isValidMarket,
    safeGetMarketClosingDate,
    safeFormatDate,
    safeGetProperty,
} from "@/utils/typeGuards";

interface MarketCardProps {
    market: Market | null | undefined;
    onOptionClick?: (marketId: string, option: MarketOption) => void;
    onConnectWallet?: () => void;
    isWalletConnected?: boolean;
    isLoading?: boolean;
    className?: string;
    onSelectMarket?: (market: Market) => void;
}

const MarketCard: React.FC<MarketCardProps> = ({
    market,
    onOptionClick,
    onConnectWallet,
    isWalletConnected = false,
    isLoading = false,
    className,
    onSelectMarket,
}) => {
    // Show skeleton while loading
    if (isLoading) {
        return <MarketCardSkeleton className={className} />;
    }

    return (
        <SafeRender
            data={market}
            validator={isValidMarket}
            fallback={<InvalidDataState dataType="market" />}
            skeleton={<MarketCardSkeleton className={className} />}
        >
            {(validMarket) => (
                <MarketCardContent
                    market={validMarket}
                    onOptionClick={onOptionClick}
                    onConnectWallet={onConnectWallet}
                    isWalletConnected={isWalletConnected}
                    className={className}
                    onSelectMarket={onSelectMarket}
                />
            )}
        </SafeRender>
    );
};

// Separate content component for better organization
interface MarketCardContentProps {
    market: Market;
    onOptionClick?: (marketId: string, option: MarketOption) => void;
    onConnectWallet?: () => void;
    isWalletConnected: boolean;
    className?: string;
    onSelectMarket?: (market: Market) => void;
}

const MarketCardContent: React.FC<MarketCardContentProps> = ({
    market,
    onOptionClick,
    onConnectWallet,
    isWalletConnected,
    className,
    onSelectMarket,
}) => {
    const closingDate = safeGetMarketClosingDate(market);

    const formatDate = (date: Date | null | undefined) => {
        return safeFormatDate(
            date,
            {
                month: "short",
                day: "numeric",
                year: "numeric",
            },
            "TBD"
        );
    };

    const formatChanceText = (percentage?: number | null) => {
        if (
            percentage === undefined ||
            percentage === null ||
            isNaN(percentage)
        ) {
            return "Unknown chance";
        }
        return `${percentage}% chance`;
    };

    const handleOptionClick = (option: MarketOption) => {
        if (!isWalletConnected) {
            onConnectWallet?.();
        } else {
            onOptionClick?.(market.id, option);
        }
    };

    const safeImageUrl = safeGetProperty(market, "imageUrl", null);
    const safeQuestion = safeGetProperty(market, "question", "Untitled Market");
    const safeChancePercentage = safeGetProperty(
        market,
        "chancePercentage",
        null
    );

    return (
        <div
            className={cn(
                "bg-card/50 rounded p-4 h-[240px] max-h-[240px]",
                "flex flex-col justify-between gap-4 hover:bg-card/80 transition-colors",
                className
            )}
        >
            <div>
                <div className="flex items-start gap-5 cursor-pointer" onClick={() => onSelectMarket?.(market)}>
                    <div className="w-12 h-12 rounded bg-muted/50 overflow-hidden flex-shrink-0">
                        {safeImageUrl ? (
                            <Image
                                src={safeImageUrl}
                                alt={safeQuestion}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    // Fallback to placeholder if image fails to load
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                    target.parentElement!.innerHTML = `
                  <div class="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                    <span class="text-lg">🔮</span>
                  </div>
                `;
                                }}
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                                <span className="text-lg">🔮</span>
                            </div>
                        )}
                    </div>

                    <h3 className="font-heading font-bold text-xl text-foreground leading-tight flex-1">
                        {safeQuestion}
                    </h3>
                </div>

                <div className="flex items-center gap-2 flex-nowrap w-full mt-5">
                    <div className="flex items-center gap-2 bg-background px-5 py-1 rounded w-full">
                        <Image
                            src="/clock.svg"
                            alt="Calendar"
                            width={16}
                            height={16}
                            className="w-4 h-4 text-foreground"
                        />
                        <span className="text-xs text-foreground font-normal">
                            {formatDate(closingDate)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 bg-background px-5 py-1 rounded w-full">
                        <Image
                            src="/chart-line.svg"
                            alt="Percent"
                            width={16}
                            height={16}
                            className="w-4 h-4 text-foreground"
                        />
                        <span className="text-xs text-foreground font-normal">
                            {formatChanceText(safeChancePercentage)}
                        </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <Button
                    className="flex-1 rounded-button"
                    onClick={() => handleOptionClick("yes")}
                    disabled={market.status !== "open"}
                >
                    Yes
                </Button>

                <Button
                    className="flex-1 rounded-button"
                    onClick={() => handleOptionClick("no")}
                    disabled={market.status !== "open"}
                    variant="destructive"
                >
                    No
                </Button>
            </div>
        </div>
    );
};

export { MarketCard };
export type { MarketCardProps };
