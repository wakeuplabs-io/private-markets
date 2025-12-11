'use client';

/**
 * Operation Item Component
 *
 * Displays a single operation with:
 * - Icon based on operation type and status
 * - Description
 * - Timestamp (relative time)
 * - Status indicator (success/error/in-progress)
 */

import React from 'react';
import type { Operation } from '@/services/operations';
import { CheckCircle2, XCircle, Loader2, Clock, TrendingUp, Trophy, Coins, ArrowRightLeft } from 'lucide-react';

interface OperationItemProps {
  operation: Operation;
}

/**
 * Get icon based on operation type
 */
function getOperationIcon(type?: string) {
  switch (type) {
    case 'bet':
      return TrendingUp;
    case 'claim':
      return Trophy;
    case 'mint':
      return Coins;
    case 'transfer':
      return ArrowRightLeft;
    default:
      return Clock;
  }
}

/**
 * Get relative time string (e.g., "2m ago", "just now")
 */
function getRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Operation item component
 */
export function OperationItem({ operation }: OperationItemProps) {
  const OperationIcon = getOperationIcon(operation.metadata?.type);
  const relativeTime = getRelativeTime(operation.startTime);

  // Status icon and color
  const statusConfig = {
    'pending': {
      icon: Clock,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/10',
      animate: false,
    },
    'in-progress': {
      icon: Loader2,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      animate: true,
    },
    'success': {
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
      animate: false,
    },
    'error': {
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      animate: false,
    },
  };

  const config = statusConfig[operation.status];
  const StatusIcon = config.icon;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg ${config.bgColor} transition-all duration-200 hover:bg-opacity-30 border border-transparent hover:border-border/50 group`}
      role="listitem"
      aria-label={`${operation.description} - ${operation.status}`}
    >
      {/* Operation Type Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <OperationIcon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Description */}
        <p className="text-sm text-foreground font-medium truncate group-hover:text-white transition-colors">
          {operation.description}
        </p>

        {/* Error message if applicable */}
        {operation.error && (
          <p className="text-xs text-destructive mt-1 truncate animate-in fade-in duration-300" title={operation.error}>
            {operation.error}
          </p>
        )}

        {/* Metadata (amount, market ID, etc.) */}
        {operation.metadata?.amount && (
          <p className="text-xs text-muted-foreground mt-1 group-hover:text-foreground transition-colors">
            Amount: {operation.metadata.amount}
          </p>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-1 group-hover:text-foreground/80 transition-colors">
          {relativeTime}
          {operation.endTime && operation.status !== 'in-progress' && (
            <span className="ml-2 opacity-60">
              ({Math.round((operation.endTime.getTime() - operation.startTime.getTime()) / 1000)}s)
            </span>
          )}
        </p>
      </div>

      {/* Status Icon */}
      <div className="flex-shrink-0">
        <StatusIcon
          className={`w-5 h-5 ${config.color} ${config.animate ? 'animate-spin' : ''} transition-transform group-hover:scale-110`}
        />
      </div>
    </div>
  );
}
