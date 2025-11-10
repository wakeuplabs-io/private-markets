/**
 * PXE Manager
 *
 * Simplified service that manages PXE operation queuing.
 * Provides sequential execution of PXE operations with better UX.
 *
 * Key Features:
 * - Sequential operation execution (queue)
 * - Operation description tracking
 * - Unified state management
 * - Adaptive status messages
 *
 * Usage:
 * ```typescript
 * const manager = PXEManager.getInstance();
 * const result = await manager.enqueue(async () => {
 *   // Your PXE operation
 * }, 'Operation description');
 * ```
 */

import { OperationQueue } from './OperationQueue';
import type {
  PXEManagerState,
  StateListener,
  QueueStatus,
  QueuedOperation,
} from './types';

export class PXEManager {
  private static instance: PXEManager | null = null;
  private operationQueue: OperationQueue;
  private listeners: Set<StateListener> = new Set();

  private state: PXEManagerState = {
    queue: {
      length: 0,
      currentOperation: null,
      isProcessing: false,
    },
    busy: false,
    message: 'Ready',
  };

  private constructor() {
    this.operationQueue = new OperationQueue();
    this.operationQueue.onStatusChange(this.handleQueueUpdate.bind(this));
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PXEManager {
    if (!PXEManager.instance) {
      PXEManager.instance = new PXEManager();
    }
    return PXEManager.instance;
  }

  /**
   * Enqueue operation
   *
   * @param operation - The operation to execute
   * @param description - Optional description for better UX
   * @returns Promise that resolves when operation completes
   */
  public async enqueue<T>(
    operation: QueuedOperation<T>,
    description?: string
  ): Promise<T> {
    const operationDesc = description || 'Processing operation';
    console.log('[PXEManager] Enqueue requested:', operationDesc);

    try {
      const result = await this.operationQueue.enqueue(operation, operationDesc);
      console.log('[PXEManager] Operation completed successfully');
      return result;
    } catch (error) {
      console.error('[PXEManager] Operation failed:', error);
      throw error;
    }
  }

  /**
   * Get current state
   */
  public getState(): PXEManagerState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   * Returns unsubscribe function
   */
  public onStateChange(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state); // Immediate call with current state
    return () => this.listeners.delete(listener);
  }

  /**
   * Handle queue status updates from OperationQueue
   */
  private handleQueueUpdate(queueStatus: QueueStatus): void {
    console.log('[PXEManager] Queue update received:', queueStatus);

    this.state.queue = queueStatus;
    this.updateBusyAndMessage();
    this.notifyListeners();
  }

  /**
   * Update busy flag and adaptive message based on current state
   */
  private updateBusyAndMessage(): void {
    const { queue } = this.state;

    // Update busy flag
    this.state.busy = queue.isProcessing || queue.length > 0;

    // Update adaptive message (priority order)
    if (queue.isProcessing && queue.currentOperation) {
      // Priority 1: Currently processing operation
      this.state.message = queue.currentOperation;
    } else if (queue.length > 0) {
      // Priority 2: Operations queued
      this.state.message = `${queue.length} operation(s) queued`;
    } else {
      // Priority 3: Ready
      this.state.message = 'Ready';
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[PXEManager] Listener error:', error);
      }
    });
  }

  /**
   * Reset manager (for testing or cleanup)
   */
  public reset(): void {
    console.log('[PXEManager] Resetting...');

    this.operationQueue.clear();
    this.listeners.clear();

    this.state = {
      queue: {
        length: 0,
        currentOperation: null,
        isProcessing: false,
      },
      busy: false,
      message: 'Ready',
    };

    this.notifyListeners();
  }
}

/**
 * Singleton instance export for convenience
 */
export const pxeManager = PXEManager.getInstance();
