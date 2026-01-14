"use client";

import React from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { cn } from "@/lib/utils";
import Image from "next/image";

// Loading states
interface LoadingStateProps {
    message?: string;
    className?: string;
    variant?: "default" | "minimal" | "card";
}

export const LoadingState: React.FC<LoadingStateProps> = ({
    message = "Loading...",
    className,
    variant = "default",
}) => {
    if (variant === "minimal") {
        return (
            <div
                className={cn(
                    "flex items-center gap-2 text-muted-foreground",
                    className
                )}
            >
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">{message}</span>
            </div>
        );
    }

    if (variant === "card") {
        return (
            <Card className={cn("p-8 text-center", className)}>
                <div className="w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <div className="text-muted-foreground">{message}</div>
            </Card>
        );
    }

    return (
        <div className={cn("space-y-6", className)}>
            <div className="h-8 w-48 bg-muted rounded animate-pulse" />
            <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg overflow-hidden">
                <div className="p-8 text-center">
                    <div className="w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                    <div className="text-muted-foreground">{message}</div>
                </div>
            </div>
        </div>
    );
};

// Error states
interface ErrorStateProps {
    title?: string;
    message?: string;
    className?: string;
    icon?: string | React.ReactNode;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    title = "Something went wrong",
    message = "There was an error loading this content.",
    className,
    icon,
}) => {
    return (
        <div className={cn("empty-state-card", className)}>
            <div className="empty-state-icon bg-destructive/20">
                {icon ? (
                    typeof icon === "string" ? (
                        <span className="text-2xl">{icon}</span>
                    ) : (
                        icon
                    )
                ) : (
                    <Image
                        src="/error.svg"
                        alt="Error"
                        width={36}
                        height={36}
                    />
                )}
            </div>
            <div className="empty-state-content">
                <h3 className="empty-state-title text-destructive">{title}</h3>
                <p className="empty-state-description">{message}</p>
            </div>
        </div>
    );
};

// Empty states
interface EmptyStateProps {
    title?: string;
    message?: string;
    actionLabel?: string;
    onAction?: () => void;
    icon?: string | React.ReactNode;
    className?: string;
    variant?: "default" | "card";
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title = "Nothing here yet",
    message = "There are no items to display.",
    actionLabel,
    onAction,
    icon = "📊",
    className,
    variant = "default",
}) => {
    if (variant === "card") {
        return (
            <div className={cn("empty-state-card", className)}>
                <div className="empty-state-icon">
                    {typeof icon === "string" ? (
                        <span className="text-2xl">{icon}</span>
                    ) : (
                        icon
                    )}
                </div>
                <div className="empty-state-content">
                    <h3 className="empty-state-title">{title}</h3>
                    <p className="empty-state-description">{message}</p>
                    {actionLabel && onAction && (
                        <Button onClick={onAction} className="mt-4">
                            {actionLabel}
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("empty-state-card", className)}>
            <div className="empty-state-icon">
                {typeof icon === "string" ? (
                    <span className="text-2xl">{icon}</span>
                ) : (
                    icon
                )}
            </div>
            <div className="empty-state-content">
                <h3 className="empty-state-title">{title}</h3>
                <p className="empty-state-description">{message}</p>
                {actionLabel && onAction && (
                    <Button onClick={onAction} className="mt-4">
                        {actionLabel}
                    </Button>
                )}
            </div>
        </div>
    );
};

// Data validation error component
interface InvalidDataStateProps {
    dataType?: string;
    onRefresh?: () => void;
    className?: string;
}

export const InvalidDataState: React.FC<InvalidDataStateProps> = ({
    dataType = "data",
    onRefresh,
    className,
}) => {
    return (
        <div className={cn("text-center py-8 px-4", className)}>
            <div className="w-12 h-12 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
                Invalid Data
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
                The {dataType} received is incomplete or invalid. This might be
                a temporary issue.
            </p>
            {onRefresh && (
                <Button onClick={onRefresh} variant="secondary" size="sm">
                    Refresh
                </Button>
            )}
        </div>
    );
};

// Skeleton loaders for different components
export const MarketCardSkeleton: React.FC<{ className?: string }> = ({
    className,
}) => (
    <div
        className={cn(
            "bg-card/50 rounded p-4 space-y-4 h-[240px] max-h-[240px] flex flex-col justify-between gap-4",
            className
        )}
    >
        <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-muted rounded animate-pulse" />
            <div className="flex-1 space-y-2">
                <div className="h-7 bg-muted rounded-full animate-pulse" />
            </div>
        </div>
        <div className="flex gap-2">
            <div className="h-7 bg-muted rounded-full flex-1 animate-pulse" />
        </div>
        <div className="flex gap-3">
            <div className="h-12 bg-muted rounded-full flex-1 animate-pulse" />
            <div className="h-12 bg-muted rounded-full flex-1 animate-pulse" />
        </div>
    </div>
);

export const AdminMarketCardSkeleton: React.FC<{ className?: string }> = ({
    className,
}) => (
    <div className={cn("w-full bg-card/50 backdrop-blur-sm rounded-md p-6 grid grid-cols-12 gap-4", className)}>
        <div className="flex items-center justify-start space-x-4 col-span-8">
            <div className="size-12 rounded-full bg-muted animate-pulse"></div>
            <div className="h-6 w-full max-w-xl rounded-lg bg-muted animate-pulse"></div>
        </div>
        <div className="flex items-center justify-start col-span-3">
            <div className="h-6 w-full max-w-[100px] rounded-lg bg-muted animate-pulse"></div>
        </div>
        <div className="flex items-center justify-start col-span-1">
            <div className="h-6 w-full max-w-[100px] rounded-lg bg-muted animate-pulse"></div>
        </div>
    </div>
);

export const ActivityRowSkeleton: React.FC<{ className?: string }> = ({
    className,
}) => (
    <div className={cn("rounded-lg bg-[#1D293D]/65 h-[100px] overflow-hidden flex items-center", className)}>
        <div className="grid grid-cols-12 gap-4 h-full items-center px-6 w-full">
            {/* Market Question - col-span-4 */}
            <div className="col-span-4">
                <div className="flex items-start space-x-3">
                    <div className="size-6 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                        <div className="h-5 w-full max-w-[280px] rounded bg-muted animate-pulse" />
                        <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                    </div>
                </div>
            </div>
            {/* Amount - col-span-2 */}
            <div className="col-span-2">
                <div className="h-5 w-16 rounded bg-muted animate-pulse" />
            </div>
            {/* Your Bet & Result - col-span-2 */}
            <div className="col-span-2">
                <div className="space-y-2">
                    <div className="h-4 w-14 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                </div>
            </div>
            {/* Status - col-span-2 */}
            <div className="col-span-2">
                <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            </div>
            {/* Action - col-span-2 */}
            <div className="col-span-2">
                <div className="h-9 w-28 rounded-lg bg-muted animate-pulse" />
            </div>
        </div>
    </div>
);

// HOC for safe component rendering
interface SafeRenderProps<T> {
    data: T | null | undefined;
    fallback?: React.ReactNode;
    skeleton?: React.ReactNode;
    children: (data: T) => React.ReactNode;
    validator?: (data: unknown) => data is T;
    className?: string;
}

export function SafeRender<T>({
    data,
    fallback,
    skeleton,
    children,
    validator,
    className,
}: SafeRenderProps<T>) {
    // Show skeleton while loading
    if (data === undefined && skeleton) {
        return <div className={className}>{skeleton}</div>;
    }

    // Show fallback for null/invalid data
    if (data === null || data === undefined) {
        return (
            <div className={className}>{fallback || <InvalidDataState />}</div>
        );
    }

    // Validate data if validator is provided
    if (validator && !validator(data)) {
        return (
            <div className={className}>{fallback || <InvalidDataState />}</div>
        );
    }

    try {
        return <div className={className}>{children(data)}</div>;
    } catch (error) {
        console.error("Error rendering component:", error);
        return (
            <div className={className}>
                <ErrorState
                    title="Render Error"
                    message="There was an error displaying this content."
                />
            </div>
        );
    }
}

// Utility function to create safe components
export function withSafeRender<T extends Record<string, unknown>>(
    Component: React.ComponentType<T>,
    validator?: (props: unknown) => props is T
) {
    return function SafeComponent(props: T) {
        if (validator && !validator(props)) {
            return <InvalidDataState dataType="component props" />;
        }

        try {
            return <Component {...props} />;
        } catch (error) {
            console.error("Error in safe component:", error);
            return (
                <ErrorState
                    title="Component Error"
                    message="There was an error rendering this component."
                />
            );
        }
    };
}
