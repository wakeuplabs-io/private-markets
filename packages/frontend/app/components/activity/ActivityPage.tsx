"use client";

import React, { useEffect } from "react";
import { useUserActivity } from "@/hooks/useUserActivity";
import { ActivityGrid } from "@/components/activity/ActivityGrid";
import { ErrorState } from "../ui/Fallbacks";
import { pxeManager } from "@/services/pxe";

export function ActivityPage() {
    const { activityData, isLoading, error, refreshActivity, claimReward } =
        useUserActivity();
    useEffect(() => {
        return () => {
            pxeManager.reset();
            console.log('[ActivityPage] Reset PXE manager on unmount');
        };
    }, []);

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
            {error ? (
                <ErrorState title="Error Loading Activity" message={error} />
            ) : (
                <ActivityGrid
                    activityData={activityData}
                    isLoading={isLoading}
                    onClaimReward={claimReward}
                    onRefresh={refreshActivity}
                />
            )}
        </div>
    );
}
