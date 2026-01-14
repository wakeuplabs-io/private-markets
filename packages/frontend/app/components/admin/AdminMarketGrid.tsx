"use client";

import React from "react";
import Image from "next/image";
import { Market } from "@/types";
import { Button } from "@/components/ui/Button";
import {
    SafeRender,
    EmptyState,
    InvalidDataState,
    AdminMarketCardSkeleton,
} from "@/components/ui/Fallbacks";
import {
    isValidArray,
    isValidMarket,
    safeGetMarketWinningOption,
} from "@/utils/typeGuards";
import { cn, formatDate } from "@/lib/utils";
import { useStatus } from "@/hooks";

interface AdminMarketGridProps {
    markets: Market[] | null | undefined;
    isLoading?: boolean;
    onCreateMarket: () => void;
    onResolveMarket: (marketId: string, winningOption: "yes" | "no") => void;
    onEditMarket?: (marketId: string) => void;
}

export const AdminMarketGrid: React.FC<AdminMarketGridProps> = ({
    markets,
    isLoading = false,
    onCreateMarket,
    onResolveMarket,
}) => {
    const { getStatusIconInfo } = useStatus();
    const ICON_DIMENSIONS = { width: 24, height: 24 };
    const getStatusIcon = (status: string | null | undefined) => {
        const strategy = getStatusIconInfo(status);
        return <Image src={strategy.src} alt={strategy.alt} width={ICON_DIMENSIONS.width} height={ICON_DIMENSIONS.height} />;
    };

    return (
        <SafeRender
            data={markets}
            validator={isValidArray}
            fallback={
                <InvalidDataState
                    dataType="markets"
                    onRefresh={() => window.location.reload()}
                />
            }
        >
            {(validMarkets) => (
                <AdminMarketGridContent
                    markets={validMarkets}
                    onCreateMarket={onCreateMarket}
                    onResolveMarket={onResolveMarket}
                    getStatusIcon={getStatusIcon}
                    formatDate={formatDate}
                    isLoading={isLoading}
                />
            )}
        </SafeRender>
    );
};

// Separate content component for better organization
interface AdminMarketGridContentProps {
    markets: Market[];
    onCreateMarket: () => void;
    onResolveMarket: (marketId: string, winningOption: "yes" | "no") => void;
    getStatusIcon: (status: string | null | undefined) => React.JSX.Element;
    formatDate: (date: Date | null | undefined, prefix?: string) => string;
    isLoading?: boolean;
}

const AdminMarketGridContent: React.FC<AdminMarketGridContentProps> = ({
    markets,
    onCreateMarket,
    onResolveMarket,
    getStatusIcon,
    formatDate,
    isLoading = false,
}) => {
    // Filter and sort only valid markets
    const validMarkets = markets.filter(isValidMarket);
    const sortedMarkets = React.useMemo(() => {
        return [...validMarkets].sort((a, b) => {
            const aTime = a.createdAt?.getTime() || 0;
            const bTime = b.createdAt?.getTime() || 0;
            return bTime - aTime;
        });
    }, [validMarkets]);

    if (!isLoading && sortedMarkets.length === 0) {
        return (
            <EmptyState
                title="No markets found"
                message="Create your first prediction market to get started"
                actionLabel="Create Market"
                onAction={onCreateMarket}
                icon={
                    <Image
                        src="/activity.svg"
                        alt="No markets found"
                        width={36}
                        height={36}
                    />
                }
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="overflow-hidden">
                <div className="overflow-x-auto lg:overflow-visible">
                    <div className="w-full lg:min-w-[800px]">
                        {/* Header */}
                        <div className="bg-muted rounded-lg p-4 hidden md:block">
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-8 font-normal text-muted-foreground">
                                    Market
                                </div>
                                <div className="col-span-3 font-normal text-muted-foreground">
                                    Options
                                </div>
                                <div className="col-span-1 font-medium text-muted-foreground">
                                    State
                                </div>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="space-y-6 mt-4">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <AdminMarketCardSkeleton key={index} />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-6 mt-4">
                                {sortedMarkets.map((market) => (
                                    <AdminMarketRow
                                        key={market.id}
                                        market={market}
                                        onResolveMarket={onResolveMarket}
                                        getStatusIcon={getStatusIcon}
                                        formatDate={formatDate}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface AdminMarketRowProps {
    market: Market;
    onResolveMarket: (marketId: string, winningOption: "yes" | "no") => void;
    getStatusIcon: (status: string | null | undefined) => React.JSX.Element;
    formatDate: (date: Date | null | undefined, prefix?: string) => string;
}

const AdminMarketRow: React.FC<AdminMarketRowProps> = ({
    market,
    onResolveMarket,
    getStatusIcon,
    formatDate,
}) => {
    const winningOption = safeGetMarketWinningOption(market);
    const textColor =
        market.status === "resolved" ? "text-foreground/50" : "text-foreground";
    return (
        <div className="rounded-lg bg-[#1D293D]/65 backdrop-blur-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-4 items-center px-4 sm:px-6 py-4 md:py-0 md:h-[100px] w-full">
                <div className="col-span-12 md:col-span-8">
                    <div className="flex items-start space-x-3">
                        <span className="text-lg mt-0.5 w-6 h-6">
                            {getStatusIcon(market.status)}
                        </span>
                        <div className="flex-1">
                            <h3
                                className={cn(
                                    "font-bold text-lg sm:text-xl md:text-2xl mb-2 leading-tight",
                                    textColor
                                )}
                            >
                                {market.question || "Untitled Market"}
                            </h3>
                            <div
                                className={cn(
                                    "flex flex-wrap gap-x-4 gap-y-1 text-sm md:text-base font-normal",
                                    textColor
                                )}
                            >
                                <span>
                                    {formatDate(market.createdAt, "Created")}
                                </span>
                                <span>
                                    {market.status === "resolved" &&
                                    market.resolvedAt
                                        ? formatDate(
                                              market.resolvedAt,
                                              "Closed"
                                          )
                                        : market.closingDate
                                        ? formatDate(
                                              market.closingDate,
                                              "Closes"
                                          )
                                        : "Closes: TBD"}
                                </span>
                                {market.status === "finalized" && (
                                    <p className="text-xs text-[hsl(var(--error))] max-w-xs leading-tight">
                                        You must select and publish the final
                                        result. Participants are waiting.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-span-12 md:col-span-3">
                    <div className="flex flex-col sm:flex-row gap-2 md:space-x-3 items-stretch md:items-end">
                        {market.status === "resolved" ? (
                            <Button
                                disabled
                                className="rounded-button"
                                variant={winningOption?.name?.toLowerCase() === "yes" ? "success" : "destructive"}
                            >
                                {winningOption?.name?.toLowerCase() === "yes" ? "Yes" : "No"}
                            </Button>
                        ) : (
                            <>
                                <Button
                                    onClick={ () => onResolveMarket(market.id, "yes") }
                                    className="rounded-button w-full sm:w-auto"
                                    disabled={market.status !== "finalized"}
                                >
                                    Yes
                                </Button>
                                <Button
                                    onClick={ () => onResolveMarket(market.id, "no") }
                                    className="rounded-button w-full sm:w-auto"
                                    disabled={market.status !== "finalized"}
                                >
                                    No
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* State Column */}
                <div className="col-span-12 md:col-span-1 mt-3 md:mt-0">
                    <div className="flex flex-col items-start">
                        <div
                            className={cn(
                                "text-sm font-bold capitalize",
                                textColor
                            )}
                        >
                            {market.status || "unknown"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
