'use client';

/**
 * Operation History Panel
 *
 * Bottom-right expandable panel showing:
 * - Current operation count (collapsed state)
 * - Full operation history (expanded state)
 * - Up to 50 operations with FIFO eviction
 * - Smooth animations and transitions
 */

import React, { useState, useEffect } from 'react';
import { useOperationHistory } from '@/context/OperationHistoryContext';
import { OperationItem } from './OperationItem';
import { ChevronUp, ChevronDown, Activity, Trash2 } from 'lucide-react';
import { operationHistoryManager } from '@/services/operations';

export function OperationHistoryPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { operations, currentOperation, inProgressCount } = useOperationHistory();

  // Show panel after first operation
  useEffect(() => {
    if (operations.length > 0 && !isVisible) {
      setIsVisible(true);
    }
  }, [operations.length, isVisible]);

  // Handle clear completed operations
  const handleClearCompleted = () => {
    operationHistoryManager.clearHistory();
  };

  // Don't render if no operations and not visible yet
  if (!isVisible) {
    return null;
  }

  // Sort operations: in-progress first, then by start time (most recent first)
  const sortedOperations = [...operations].sort((a, b) => {
    if (a.status === 'in-progress' && b.status !== 'in-progress') return -1;
    if (a.status !== 'in-progress' && b.status === 'in-progress') return 1;
    return b.startTime.getTime() - a.startTime.getTime();
  });

  const completedCount = operations.filter(op =>
    op.status === 'success' || op.status === 'error'
  ).length;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Expanded Panel */}
      {isExpanded ? (
        <div
          className="bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-2xl w-96 max-h-[600px] flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200"
          role="dialog"
          aria-label="Operation history panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Operation History
              </h3>
              {inProgressCount > 0 && (
                <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full border border-primary/30">
                  {inProgressCount} active
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Clear completed button */}
              {completedCount > 0 && (
                <button
                  onClick={handleClearCompleted}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
                  aria-label="Clear completed operations"
                  title="Clear completed operations"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Collapse button */}
              <button
                onClick={() => setIsExpanded(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-card"
                aria-label="Collapse panel"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Operations List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {sortedOperations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm animate-in fade-in duration-300">
                No operations yet
              </div>
            ) : (
              sortedOperations.map((operation, index) => (
                <div
                  key={operation.id}
                  className="animate-in slide-in-from-top-2 fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <OperationItem operation={operation} />
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
            {operations.length} of 50 operations
            {completedCount > 0 && (
              <span className="opacity-60 ml-2">
                ({completedCount} completed)
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Collapsed Button */
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-card/95 hover:bg-card border border-border active:scale-95 text-foreground rounded-lg shadow-lg transition-all hover:shadow-xl hover:scale-105 flex items-center gap-2 px-4 py-3 animate-in slide-in-from-bottom-4 fade-in duration-300"
          aria-label="Expand operation history"
          aria-expanded="false"
        >
          <Activity
            className={`w-5 h-5 text-primary transition-transform ${inProgressCount > 0 ? 'animate-spin' : ''}`}
            style={{ animationDuration: inProgressCount > 0 ? '2s' : undefined }}
          />

          {/* Badge with count */}
          {inProgressCount > 0 ? (
            <span className="flex items-center gap-1 animate-in fade-in duration-200">
              <span className="font-semibold">{inProgressCount}</span>
              <span className="text-sm">in progress</span>
              <ChevronUp className="w-4 h-4 ml-1" />
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="text-sm">View history</span>
              <ChevronUp className="w-4 h-4" />
            </span>
          )}
        </button>
      )}
    </div>
  );
}
