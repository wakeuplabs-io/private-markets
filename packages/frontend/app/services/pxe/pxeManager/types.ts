/**
 * PXE Manager Types
 *
 * Shared types for the unified PXE queue management system.
 * Simplified version focusing only on operation queuing.
 */

/**
 * Operation queue status
 */
export interface QueueStatus {
  length: number;
  currentOperation: string | null;
  isProcessing: boolean;
}

/**
 * Unified PXE Manager state (simplified - queue only)
 */
export interface PXEManagerState {
  // Operation queue
  queue: QueueStatus;

  // Overall status
  busy: boolean; // true if queue processing
  message: string; // Current operation or "Ready"
}

/**
 * State change listener
 */
export type StateListener = (state: PXEManagerState) => void;

/**
 * Operation to be queued
 */
export type QueuedOperation<T> = () => Promise<T>;
