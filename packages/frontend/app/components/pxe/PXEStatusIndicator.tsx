/**
 * PXE Status Indicator
 *
 * Corner indicator that shows PXE queue state when operations are in progress.
 * Hidden when everything is ready.
 */

'use client';

import { usePXEManager } from '@/hooks/pxe/usePXEManager';

export function PXEStatusIndicator() {
  const state = usePXEManager();

  if (!state.busy) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-xs border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full animate-pulse bg-blue-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Processing
          </span>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
          {state.message}
        </p>

        {state.queue.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {state.queue.length} {state.queue.length === 1 ? 'operation' : 'operations'} waiting
          </p>
        )}
      </div>
    </div>
  );
}
