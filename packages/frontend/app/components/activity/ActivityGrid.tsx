"use client";

import React from "react";
import Image from "next/image";
import { UserActivityData, UserBet, MarketStatus } from "@/types";
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
import { useStatus } from "@/hooks/useStatus";
import { useWallet } from "@/context";
import {
    CheckCircle2,
    XCircle,
    Clock,
    Circle,
    Gift,
    Loader2
} from "lucide-react";

interface ActivityGridProps {
    activityData: UserActivityData | null;
    isLoading?: boolean;
    onClaimReward: (betId: string, marketId: string, recipientAddress: string) => Promise<void>;
    onRefresh: () => Promise<void>;
}

export const ActivityGrid: React.FC<ActivityGridProps> = ({
    activityData,
    isLoading = true,
    onClaimReward,
    onRefresh,
}) => {
    const { getStatusIconInfo, getMarketStatusColor } = useStatus();
    
    const ICON_DIMENSIONS = { width: 24, height: 24 } as const;
    
    const getStatusIcon = (status: MarketStatus): React.JSX.Element => {
        const iconInfo = getStatusIconInfo(status);
        return <Image src={iconInfo.src} alt={iconInfo.alt} {...ICON_DIMENSIONS} />;
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
                    getStatusColor={getMarketStatusColor}
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
    onClaimReward: (betId: string, marketId: string, recipientAddress: string) => Promise<void>;
    getStatusIcon: (status: MarketStatus) => React.JSX.Element;
    getStatusColor: (status: MarketStatus) => string;
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
                title="No recent activity"
                message="You haven't placed any bets yet. Start exploring markets and make your first prediction!"
                actionLabel="Browse Markets"
                onAction={() => window.location.href = '/markets'}
                icon={
                    <Image
                        src="/activity.svg"
                        alt="No recent activity"
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
                <div className="overflow-x-auto">
                    <div className="w-full min-w-[1000px]">
                        {/* Header */}
                        <div className="bg-muted rounded-lg p-4">
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-4 font-normal text-muted-foreground">
                                    Market Question
                                </div>
                                <div className="col-span-2 font-normal text-muted-foreground">
                                    Amount
                                </div>
                                <div className="col-span-2 font-normal text-muted-foreground">
                                    Your Bet & Result
                                </div>
                                <div className="col-span-2 font-normal text-muted-foreground">
                                    Status
                                </div>
                                <div className="col-span-2 font-normal text-muted-foreground">
                                    Action
                                </div>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="space-y-6 mt-4">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <AdminMarketCardSkeleton key={`skeleton-${index}`} />
                                ))}
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

interface ActivityRowProps {
    bet: UserBet;
    onClaimReward: (betId: string, marketId: string, recipientAddress: string) => Promise<void>;
    getStatusIcon: (status: MarketStatus) => React.JSX.Element;
    getStatusColor: (status: MarketStatus) => string;
    formatDate: (date: Date | null | undefined, prefix?: string) => string;
}

const ActivityRow: React.FC<ActivityRowProps> = ({
    bet,
    onClaimReward,
    getStatusIcon,
    formatDate,
}) => {
    const [isClaiming, setIsClaiming] = React.useState(false);
    const { wallet } = useWallet();

    const handleClaim = async () => {
        try {
            setIsClaiming(true);

            if (!wallet?.address) {
                throw new Error('Wallet not connected. Please connect your Aztec wallet to claim rewards.');
            }

            // Pass all required parameters: betId, marketId, and Aztec address
            await onClaimReward(bet.id, bet.marketId, wallet.address);
        } catch (error) {
            console.error('Error claiming reward:', error);
            // Re-throw to allow parent components to handle the error
            throw error;
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
            if (bet.isWinning) {
                return (
                    <span className="text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Won ({winningOption})
                    </span>
                );
            }
            return (
                <span className="text-red-400 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    Lost ({winningOption})
                </span>
            );
        }
        return (
            <span className="text-yellow-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Pending
            </span>
        );
    };

    const getBetStatusDisplay = () => {
        if (bet.status === 'claimed') {
            return (
                <div className="flex items-center gap-1.5">
                    <Circle className="w-2 h-2 fill-green-400 text-green-400" />
                    <span className="capitalize text-green-400">Claimed</span>
                </div>
            );
        }
        if (bet.status === 'confirmed') {
            return (
                <div className="flex items-center gap-1.5">
                    <Circle className="w-2 h-2 fill-blue-400 text-blue-400" />
                    <span className="capitalize text-blue-400">Confirmed</span>
                </div>
            );
        }
        if (bet.status === 'pending') {
            return (
                <div className="flex items-center gap-1.5">
                    <Circle className="w-2 h-2 fill-yellow-400 text-yellow-400" />
                    <span className="capitalize text-yellow-400">Pending</span>
                </div>
            );
        }
        return (
            <div className="flex items-center gap-1.5">
                <Circle className="w-2 h-2 fill-gray-400 text-gray-400" />
                <span className="capitalize text-gray-400">{bet.status}</span>
            </div>
        );
    };

    const getClaimStatusMessage = (bet: UserBet) => {
        // Already claimed
        if (bet.status === 'claimed') {
            return (
                <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Already claimed
                </span>
            );
        }

        // Market not resolved yet
        if (bet.marketStatus !== 'resolved') {
            return (
                <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Market not resolved
                </span>
            );
        }

        // Lost bet
        if (!bet.isWinning) {
            return (
                <span className="flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Bet lost
                </span>
            );
        }

        // Default fallback
        return 'Not claimable';
    };

    const textColor = bet.marketStatus === "resolved" ? "text-foreground/50" : "text-foreground";
    return (
        <div className="rounded-lg bg-[#1D293D]/65 h-[100px] overflow-hidden flex items-center">
            <div className="grid grid-cols-12 gap-4 h-full items-center px-6 w-full">
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

                <div className="col-span-2">
                    <div className="flex flex-col gap-1">
                        <div className={cn("text-sm font-medium", textColor)}>
                            Bet: {getOptionDisplay(bet.option)}
                        </div>
                        <div className="text-xs">
                            {getResultDisplay()}
                        </div>
                    </div>
                </div>

                <div className="col-span-2">
                    <div className="flex flex-col">
                        {getBetStatusDisplay()}
                    </div>
                </div>

                <div className="col-span-2">
                    {bet.isClaimable ? (
                        <Button
                            onClick={handleClaim}
                            disabled={isClaiming}
                            className="rounded-button"
                        >
                            {isClaiming ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Claiming...
                                </>
                            ) : (
                                <>
                                    <Gift className="w-4 h-4 mr-2" />
                                    Claim Reward
                                </>
                            )}
                        </Button>
                    ) : (
                        <div className={cn(
                            "text-xs px-3 py-2 rounded-md inline-block",
                            bet.status === 'claimed'
                                ? "bg-green-500/10 text-green-400"
                                : bet.marketStatus !== 'resolved'
                                ? "bg-yellow-500/10 text-yellow-400"
                                : "bg-red-500/10 text-red-400"
                        )}>
                            {getClaimStatusMessage(bet)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
