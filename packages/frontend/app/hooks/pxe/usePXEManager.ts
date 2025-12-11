/**
 * usePXEManager Hook
 *
 * Main hook for accessing unified PXE Manager state.
 * Provides the complete state including sync and queue status.
 */

'use client';

import { usePXEManagerContext } from '@/providers/pxe/PXEManagerProvider';
import type { PXEManagerState } from '@/services/pxe';

/**
 * Hook to access complete PXE Manager state
 *
 * @returns Complete unified state (sync + queue + busy + message)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const state = usePXEManager();
 *
 *   if (state.busy) {
 *     return <div>Busy: {state.message}</div>;
 *   }
 *
 *   return <div>Ready</div>;
 * }
 * ```
 */
export function usePXEManager(): PXEManagerState {
  const { state } = usePXEManagerContext();
  return state;
}
