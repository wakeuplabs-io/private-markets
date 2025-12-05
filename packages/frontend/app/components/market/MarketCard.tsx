"use client";

import React from "react";
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
            return "--";
        }
        return `${percentage}%`;
    };

    const handleOptionClick = (option: MarketOption) => {
        if (!isWalletConnected) {
            onConnectWallet?.();
        } else {
            onOptionClick?.(market.id, option);
        }
    };

    const safeQuestion = safeGetProperty(market, "question", "Untitled Market");
    const safeChancePercentage = safeGetProperty(
        market,
        "chancePercentage",
        null
    );

    const isOpen = market.status === "open";

    return (
        <div
            className={cn(
                "bg-card/50 w-full rounded-xl p-5",
                "flex flex-col justify-between gap-4",
                "border border-border/50 hover:border-border",
                "hover:bg-card/80 transition-all duration-200",
                "cursor-pointer",
                className
            )}
            onClick={() => onSelectMarket?.(market)}
        >
            {/* Header with status badge */}
            <div className="flex items-start justify-between gap-3">
                <h3 className="font-heading font-semibold text-lg text-foreground leading-snug flex-1 line-clamp-2">
                    {safeQuestion}
                </h3>
                <span
                    className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                        isOpen
                            ? "bg-green-500/20 text-green-400"
                            : "bg-muted text-muted-foreground"
                    )}
                >
                    {isOpen ? "Open" : "Closed"}
                </span>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-background/60 px-3 py-1.5 rounded-lg">
                    <svg
                        className="w-3.5 h-3.5 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12,6 12,12 16,14" />
                    </svg>
                    <span className="text-xs text-muted-foreground">
                        {formatDate(closingDate)}
                    </span>
                </div>

                <div className="flex items-center gap-2 bg-background/60 px-3 py-1.5 rounded-lg">
                    <svg
                        className="w-3.5 h-3.5 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path d="M3 3v18h18" />
                        <path d="M18 9l-5 5-4-4-3 3" />
                    </svg>
                    <span className="text-xs text-muted-foreground">
                        {formatChanceText(safeChancePercentage)} chance
                    </span>
                </div>
            </div>

            {/* Action buttons */}
            <div
                className="flex items-center gap-2 pt-2"
                onClick={(e) => e.stopPropagation()}
            >
                <Button
                    className="flex-1 h-9 rounded-lg font-medium"
                    onClick={() => handleOptionClick("yes")}
                    disabled={!isOpen}
                >
                    Yes
                </Button>

                <Button
                    className="flex-1 h-9 rounded-lg font-medium"
                    onClick={() => handleOptionClick("no")}
                    disabled={!isOpen}
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
