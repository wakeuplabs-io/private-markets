"use client";

import React from "react";
import Image from "next/image";
import { UserActivityData, UserBet } from "@/types";
import { Button } from "@/components/ui/Button";
import {
    SafeRender,
    EmptyState,
    InvalidDataState,
    AdminMarketCardSkeleton,
} from "@/components/ui/Fallbacks";
import {
    isValidArray,
} from "@/utils/typeGuards";
import { cn, formatDate } from "@/lib/utils";

interface ActivityGridProps {
    activityData: UserActivityData | null;
    isLoading?: boolean;
    onClaimReward: (betId: string) => Promise<void>;
    onRefresh: () => Promise<void>;
}

export const ActivityGrid: React.FC<ActivityGridProps> = ({
    activityData,
    isLoading = false,
    onClaimReward,
    onRefresh,
}) => {
    const ICON_DIMENSIONS = { width: 24, height: 24 } as const;
    const STATUS_ICON_STRATEGIES = {
        open: { src: "/clock.svg", alt: "Open" },
        finalized: { src: "/warning.svg", alt: "Finalized" },
        resolved: { src: "/success.svg", alt: "Resolved" },
        default: { src: "/file.svg", alt: "Unknown" }
    } as const;

    const getStatusIcon = (status: string | null | undefined) => {
        const strategy = STATUS_ICON_STRATEGIES[status as keyof typeof STATUS_ICON_STRATEGIES] 
            || STATUS_ICON_STRATEGIES.default;
        
        return <Image src={strategy.src} alt={strategy.alt} {...ICON_DIMENSIONS} />;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed':
                return 'text-foreground'
            case 'claimable':
                return 'text-foreground'
            case 'claimed':
                return 'text-foreground/50'
            case 'won':
                return 'text-foreground/50'
            case 'lost':
                return 'text-foreground/50'
            case 'failed':
                return 'text-foreground/50'
            case 'pending':
                return 'text-foreground'
            default:
                return 'text-foreground'
        }
    };

    return (
        <SafeRender
            data={activityData?.bets}
            validator={isValidArray}
            fallback={
                <InvalidDataState
                    dataType="activity data"
                    onRefresh={onRefresh}
                />
            }
        >
            {(validBets) => (
                <ActivityGridContent
                    bets={validBets}
                    onClaimReward={onClaimReward}
                    getStatusIcon={getStatusIcon}
                    getStatusColor={getStatusColor}
                    formatDate={formatDate}
                    isLoading={isLoading}
                />
            )}
        </SafeRender>
    );
};

// Separate content component for better organization
interface ActivityGridContentProps {
    bets: UserBet[];
    onClaimReward: (betId: string) => Promise<void>;
    getStatusIcon: (status: string | null | undefined) => React.JSX.Element;
    getStatusColor: (status: string) => string;
    formatDate: (date: Date | null | undefined, prefix?: string) => string;
    isLoading?: boolean;
}

const ActivityGridContent: React.FC<ActivityGridContentProps> = ({
    bets,
    onClaimReward,
    getStatusIcon,
    getStatusColor,
    formatDate,
    isLoading = false,
}) => {
    // Sort bets by placed date (newest first)
    const sortedBets = React.useMemo(() => {
        return [...bets].sort((a, b) => {
            const aTime = a.placedAt?.getTime() || 0;
            const bTime = b.placedAt?.getTime() || 0;
            return bTime - aTime;
        });
    }, [bets]);

    if (!isLoading && sortedBets.length === 0) {
        return (
            <EmptyState
                title="No activity found"
                message="You haven't placed any bets yet. Start betting on prediction markets to see your activity here."
                actionLabel="Browse Markets"
                onAction={() => window.location.href = '/markets'}
                icon="🎯"
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="w-full min-w-[1000px]">
                        {/* Header */}
                        <div className="bg-muted rounded-lg p-4">
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-4 font-normal text-muted-foreground">
                                    Market
                                </div>
                                <div className="col-span-2 font-normal text-muted-foreground">
                                    Bet
                                </div>
                                <div className="col-span-2 font-normal text-muted-foreground">
                                    Option
                                </div>
                                <div className="col-span-2 font-normal text-muted-foreground">
                                    State
                                </div>
                                <div className="col-span-2 font-normal text-muted-foreground">
                                    Action
                                </div>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="space-y-6 mt-4">
                                <AdminMarketCardSkeleton />
                                <AdminMarketCardSkeleton />
                                <AdminMarketCardSkeleton />
                                <AdminMarketCardSkeleton />
                            </div>
                        ) : (
                            <div className="space-y-6 mt-4">
                                {sortedBets.map((bet) => (
                                    <ActivityRow
                                        key={bet.id}
                                        bet={bet}
                                        onClaimReward={onClaimReward}
                                        getStatusIcon={getStatusIcon}
                                        getStatusColor={getStatusColor}
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

// Individual activity row component
interface ActivityRowProps {
    bet: UserBet;
    onClaimReward: (betId: string) => Promise<void>;
    getStatusIcon: (status: string | null | undefined) => React.JSX.Element;
    getStatusColor: (status: string) => string;
    formatDate: (date: Date | null | undefined, prefix?: string) => string;
}

const ActivityRow: React.FC<ActivityRowProps> = ({
    bet,
    onClaimReward,
    getStatusIcon,
    getStatusColor,
    formatDate,
}) => {
    const [isClaiming, setIsClaiming] = React.useState(false);

    const handleClaim = async () => {
        try {
            setIsClaiming(true);
            await onClaimReward(bet.id);
        } catch (error) {
            console.error('Error claiming reward:', error);
        } finally {
            setIsClaiming(false);
        }
    };

    const getOptionDisplay = (option: string) => {
        return option === 'yes' ? 'Yes' : 'No';
    };

    const getResultDisplay = () => {
        if (bet.marketStatus === 'resolved' && bet.marketWinningOption) {
            const winningOption = getOptionDisplay(bet.marketWinningOption);
            return bet.isWinning ? `Won (${winningOption})` : `Lost (${winningOption})`;
        }
        return 'Pending';
    };

    // Use same text color logic as admin
    const textColor = bet.marketStatus === "resolved" ? "text-foreground/50" : "text-foreground";

    return (
        <div className="rounded-lg bg-[#1D293D]/65 backdrop-blur-sm h-[100px] overflow-hidden flex items-center">
            <div className="grid grid-cols-12 gap-4 h-full items-center px-6 w-full">
                {/* Market Column */}
                <div className="col-span-4">
                    <div className="flex items-start space-x-3">
                        <span className="text-lg mt-0.5 w-6 h-6">
                            {getStatusIcon(bet.marketStatus)}
                        </span>
                        <div className="flex-1">
                            <h3 className={cn("font-bold text-lg mb-1 leading-tight", textColor)}>
                                {bet.marketQuestion}
                            </h3>
                            <div className={cn("flex space-x-4 text-sm", textColor)}>
                                <span>
                                    {formatDate(bet.placedAt, "Placed")}
                                </span>
                                {bet.marketResolvedAt && (
                                    <span>
                                        {formatDate(bet.marketResolvedAt, "Resolved")}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bet Amount Column */}
                <div className="col-span-2">
                    <div className={cn("text-lg font-semibold", textColor)}>
                        {bet.amount} ETH
                    </div>
                    {bet.potentialReward && bet.potentialReward > 0 && (
                        <div className="text-sm text-green-400">
                            +{bet.potentialReward} ETH
                        </div>
                    )}
                </div>

                {/* Option Column */}
                <div className="col-span-2">
                    <div className="flex flex-col">
                        <div className={cn("text-sm font-medium", textColor)}>
                            {getOptionDisplay(bet.option)}
                        </div>
                        <div className={cn("text-xs", textColor)}>
                            {getResultDisplay()}
                        </div>
                    </div>
                </div>

                {/* State Column */}
                <div className="col-span-2">
                    <div className="flex flex-col">
                        <div className={cn("text-sm font-bold capitalize", textColor)}>
                            {bet.status}
                        </div>
                    </div>
                </div>

                {/* Action Column */}
                <div className="col-span-2">
                    {bet.isClaimable && (
                        <Button
                            onClick={handleClaim}
                            disabled={isClaiming}
                            className="rounded-button"
                        >
                            {isClaiming ? 'Claiming...' : 'Claim'}
                        </Button>
                    )}
                    {bet.status === 'claimed' && (
                        <div className="text-sm text-green-400 font-medium">
                            Claimed
                        </div>
                    )}
                    {bet.status === 'lost' && (
                        <div className="text-sm text-red-400 font-medium">
                            Lost
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
