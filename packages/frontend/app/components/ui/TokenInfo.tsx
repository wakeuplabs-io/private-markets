"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { TokenDisplayProps } from "@/types/token";

/**
 * TokenInfo component for displaying token name and symbol
 * Shows loading states and error handling
 */
export default function TokenInfo({
  tokenInfo,
  loading,
  error,
  className
}: TokenDisplayProps) {
  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="animate-pulse">
          <div className="h-4 w-16 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 text-destructive", className)}>
        <span className="text-xs">⚠️ Token error</span>
      </div>
    );
  }

  if (!tokenInfo) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex flex-col items-end">
        <div className="text-sm font-semibold text-foreground">
          {tokenInfo.symbol}
        </div>
        <div className="text-xs text-muted-foreground leading-none">
          {tokenInfo.name}
        </div>
      </div>
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
    </div>
  );
}

/**
 * Compact version for smaller spaces.
 */
export function TokenInfoCompact({
  tokenInfo,
  loading,
  error,
  className
}: TokenDisplayProps) {
  if (loading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-3 w-12 bg-muted rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-destructive text-xs", className)}>
        ⚠️
      </div>
    );
  }

  if (!tokenInfo) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1 text-sm", className)}>
      <span className="font-medium text-foreground">{tokenInfo.symbol}</span>
      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
    </div>
  );
}

export function TokenInfoBadge({
  tokenInfo,
  loading,
  error,
  className
}: TokenDisplayProps) {
  if (loading) {
    return (
      <div className={cn(
        "px-2 py-1 rounded-md bg-muted/50 animate-pulse",
        className
      )}>
        <div className="h-3 w-10 bg-muted rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(
        "px-2 py-1 rounded-md bg-destructive/10 text-destructive text-xs",
        className
      )}>
        Token Error
      </div>
    );
  }

  if (!tokenInfo) {
    return null;
  }

  return (
    <div className={cn(
      "px-3 py-1.5 rounded-lg bg-card/70 border border-border backdrop-blur-sm",
      "flex items-center gap-2",
      className
    )}>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground leading-none">
          {tokenInfo.symbol}
        </span>
        <span className="text-xs text-muted-foreground leading-none mt-0.5">
          {tokenInfo.name}
        </span>
      </div>
      <div className="w-2 h-2 rounded-full bg-green-500" />
    </div>
  );
}