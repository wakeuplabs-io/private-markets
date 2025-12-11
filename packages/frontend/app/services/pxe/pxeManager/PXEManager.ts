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
import { operationEventBus } from '@/lib/utils/operationEventBus';
import { operationHistoryManager } from '@/services/operations';
import { handlePXEIndexedDBError } from '@/lib/aztec/pxeErrorHandler';

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

    const operationId = operationHistoryManager.addOperation(
      operationDesc,
      { type: this.inferOperationType(operationDesc) }
    );

    operationEventBus.emit({
      type: 'START',
      operationId,
      timestamp: new Date(),
    });

    try {
      operationHistoryManager.updateOperation(operationId, {
        status: 'in-progress'
      });

      const result = await this.operationQueue.enqueue(operation, operationDesc);

      operationEventBus.emit({
        type: 'SUCCESS',
        operationId,
        timestamp: new Date(),
        data: result,
      });

      operationHistoryManager.updateOperation(operationId, {
        status: 'success',
        endTime: new Date(),
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      operationEventBus.emit({
        type: 'ERROR',
        operationId,
        timestamp: new Date(),
        data: { error: errorMessage },
      });

      operationHistoryManager.updateOperation(operationId, {
        status: 'error',
        endTime: new Date(),
        error: errorMessage,
      });

      const errorContext = {
        operationId,
        description: operationDesc,
        errorType: error instanceof Error ? error.name : 'Unknown',
        errorMessage,
        queueLength: this.state.queue.length,
        queueProcessing: this.state.queue.isProcessing,
        timestamp: new Date().toISOString(),
      };

      if (errorMessage.includes('TransactionInactiveError') ||
          errorMessage.includes('transaction has finished') ||
          errorMessage.includes('IDBCursor')) {
        console.error('[PXEManager] IndexedDB transaction error detected:', errorContext);
        console.warn('[PXEManager] Possible causes: long sync operation, browser throttling, or database timeout');

        // Trigger user-friendly error recovery
        // This will show a notification and offer to clean IndexedDB + reload
        handlePXEIndexedDBError(error as Error, {
          operation: operationDesc,
          operationId,
          queueLength: this.state.queue.length,
        }).catch(recoveryError => {
          console.error('[PXEManager] Error recovery failed:', recoveryError);
        });
      } else {
        console.error('[PXEManager] Operation failed:', errorContext);
      }

      throw error;
    } finally {
      operationEventBus.emit({
        type: 'COMPLETE',
        operationId,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Infer operation type from description
   * @param description - Operation description
   * @returns Operation type or undefined
   */
  private inferOperationType(description: string): 'bet' | 'claim' | 'mint' | 'transfer' | 'query' | undefined {
    const lower = description.toLowerCase();
    if (lower.includes('bet') || lower.includes('apuesta')) return 'bet';
    if (lower.includes('claim') || lower.includes('reclaim') || lower.includes('authori')) return 'claim';
    if (lower.includes('mint') || lower.includes('acu')) return 'mint';
    if (lower.includes('transfer')) return 'transfer';
    if (lower.includes('loading') || lower.includes('loading') || lower.includes('checking')) return 'query';
    return undefined;
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
      // Priority 1: Currently processing operation with name
      this.state.message = queue.currentOperation;
    } else if (queue.isProcessing) {
      // Priority 2: Processing but no operation name (transitional state)
      this.state.message = 'Processing...';
    } else if (queue.length > 0) {
      // Priority 3: Operations queued
      this.state.message = `${queue.length} operation(s) queued`;
    } else {
      // Priority 4: Ready
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
