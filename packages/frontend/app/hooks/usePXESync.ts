"use client"

import { useState, useEffect } from 'react';
import { pxeSyncService, type PXESyncStatus } from '@/services/pxeSyncService';

/**
 * usePXESync Hook
 *
 * React hook for accessing PXE synchronization status.
 * Automatically subscribes to status updates and unsubscribes on unmount.
 *
 * Usage:
 * ```typescript
 * const { synced, syncing, currentBlock, targetBlock, progress, lastError } = usePXESync();
 *
 * if (!synced) {
 *   return <SyncIndicator progress={progress} />;
 * }
 * ```
 */
export function usePXESync(): PXESyncStatus {
  const [status, setStatus] = useState<PXESyncStatus>(() =>
    pxeSyncService.getStatus()
  );

  useEffect(() => {
    // Subscribe to status changes
    const unsubscribe = pxeSyncService.onStatusChange(setStatus);

    // Cleanup on unmount
    return unsubscribe;
  }, []);

  return status;
}

/**
 * usePXEWaitForSync Hook
 *
 * React hook that provides a function to wait for PXE sync.
 * Useful for components that need to ensure PXE is synced before operations.
 *
 * Usage:
 * ```typescript
 * const { waitForSync, isWaiting } = usePXEWaitForSync();
 *
 * const handleAction = async () => {
 *   await waitForSync();
 *   // Now PXE is synced, proceed with operation
 * };
 * ```
 */
export function usePXEWaitForSync() {
  const [isWaiting, setIsWaiting] = useState(false);

  const waitForSync = async (timeoutMs = 120000): Promise<void> => {
    setIsWaiting(true);
    try {
      await pxeSyncService.waitForSync(timeoutMs);
    } finally {
      setIsWaiting(false);
    }
  };

  const waitForBlock = async (
    targetBlock: number,
    timeoutMs = 120000
  ): Promise<void> => {
    setIsWaiting(true);
    try {
      await pxeSyncService.waitForBlock(targetBlock, timeoutMs);
    } finally {
      setIsWaiting(false);
    }
  };

  return {
    waitForSync,
    waitForBlock,
    isWaiting,
  };
}
