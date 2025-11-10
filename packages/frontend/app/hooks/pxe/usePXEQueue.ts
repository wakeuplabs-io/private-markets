/**
 * usePXEQueue Hook
 *
 * Specialized hook for accessing operation queue status only.
 * Use this when you only need queue information.
 */

'use client';

import { usePXEManagerContext } from '@/providers/pxe/PXEManagerProvider';
import type { QueueStatus } from '@/services/pxeManager';

/**
 * Hook to access operation queue status
 *
 * @returns Queue status (length, current operation, processing state)
 *
 * @example
 * ```tsx
 * function QueueDisplay() {
 *   const { length, currentOperation, isProcessing } = usePXEQueue();
 *
 *   if (isProcessing) {
 *     return <div>Processing: {currentOperation}</div>;
 *   }
 *
 *   if (length > 0) {
 *     return <div>{length} operations queued</div>;
 *   }
 *
 *   return <div>Queue empty</div>;
 * }
 * ```
 */
export function usePXEQueue(): QueueStatus {
  const { state } = usePXEManagerContext();
  return state.queue;
}
