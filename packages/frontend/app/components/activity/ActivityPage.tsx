"use client";

import React from "react";
import { useUserActivity } from "@/hooks/useUserActivity";
import { ActivityGrid } from "@/components/activity/ActivityGrid";

export function ActivityPage() {
    const {
        activityData,
        isLoading,
        error,
        connectionStatus,
        refreshActivity,
        claimReward,
    } = useUserActivity();

    if (isLoading) {
        return (
            <div className="container mx-auto px-8 py-16">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-muted-foreground">
                            Loading your activity...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-8 py-16">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                            <span className="text-red-500 text-xl">⚠️</span>
                        </div>
                        <h2 className="text-xl font-semibold text-foreground">Error Loading Activity</h2>
                        <p className="text-muted-foreground max-w-md">{error}</p>
                        <button
                            onClick={refreshActivity}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-8 py-8">
            <div className="flex justify-between items-center mb-8">
                <div className="mb-2">
                    <h1 className="heading-h1">My Activity</h1>
                    <p className="text-muted-foreground">
                        Track your betting history and claim rewards
                    </p>
                </div>
            </div>


            <ActivityGrid
                activityData={activityData}
                isLoading={isLoading}
                onClaimReward={claimReward}
                onRefresh={refreshActivity}
            />
        </div>
    );
}
