/**
 * PXE Status Indicator
 *
 * Simplified UI component that displays PXE queue state adaptively:
 * - Fullscreen modal for blocking operations (queue processing)
 * - Corner indicator for queued operations
 * - Hidden when everything is ready
 */

'use client';

import { usePXEManager } from '@/hooks/pxe/usePXEManager';

export function PXEStatusIndicator() {
  const state = usePXEManager();

  // Don't show if nothing is happening
  if (!state.busy) {
    return null;
  }

  // Determine UI mode based on state
  const isFullscreen = state.queue.isProcessing; // Blocking operation
  const isCorner = state.queue.length > 0 && !state.queue.isProcessing; // Queued

  // Fullscreen modal for blocking operations
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md shadow-2xl border border-gray-200 dark:border-gray-700">
          {/* Spinner */}
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />

          {/* Main message */}
          <p className="text-center text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {state.message}
          </p>

          {/* Queue info */}
          {state.queue.length > 0 && (
            <p className="text-xs text-center mt-3 text-gray-500 dark:text-gray-400">
              {state.queue.length} operation(s) in queue
            </p>
          )}
        </div>
      </div>
    );
  }

  // Corner indicator for queued operations
  if (isCorner) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-xs border border-gray-200 dark:border-gray-700">
          {/* Header with status dot */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full animate-pulse bg-blue-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Queued
            </span>
          </div>

          {/* Message */}
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
            {state.message}
          </p>

          {/* Queue count */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {state.queue.length} {state.queue.length === 1 ? 'operation' : 'operations'} waiting
          </p>
        </div>
      </div>
    );
  }

  return null;
}
