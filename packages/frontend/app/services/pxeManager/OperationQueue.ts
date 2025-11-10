/**
 * Operation Queue
 *
 * Extracted from PXEQueueService to provide operation queuing functionality
 * for the unified PXEManager.
 *
 * Responsibilities:
 * - Maintain a queue of PXE operations
 * - Execute operations sequentially (PXE doesn't support concurrent operations)
 * - Track queue length and processing state
 */

import type { QueueStatus, QueuedOperation } from './types';

type QueueListener = (status: QueueStatus) => void;

export class OperationQueue {
  private queue: Array<() => Promise<unknown>> = [];
  private isProcessing = false;
  private listeners: Set<QueueListener> = new Set();
  private currentOperation: string | null = null;

  /**
   * Enqueue a PXE operation with optional description
   * Returns a promise that resolves when the operation completes
   */
  public async enqueue<T>(
    operation: QueuedOperation<T>,
    description?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Wrap operation with description tracking
      this.queue.push(async () => {
        this.currentOperation = description || null;
        this.notifyListeners();

        try {
          const result = await operation();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        } finally {
          this.currentOperation = null;
        }
      });

      this.notifyListeners();

      // Start processing if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.notifyListeners();

    while (this.queue.length > 0) {
      const operation = this.queue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error('[OperationQueue] Operation failed:', error);
          // Continue processing even if one operation fails
        }
        this.notifyListeners();
      }
    }

    this.isProcessing = false;
    this.currentOperation = null;
    this.notifyListeners();
  }

  /**
   * Get current queue status
   */
  public getStatus(): QueueStatus {
    return {
      length: this.queue.length,
      currentOperation: this.currentOperation,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Subscribe to queue status changes
   * Returns unsubscribe function
   */
  public onStatusChange(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus()); // Immediate call with current status
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        console.error('[OperationQueue] Listener error:', error);
      }
    });
  }

  /**
   * Clear the queue (useful for cleanup/testing)
   */
  public clear(): void {
    this.queue = [];
    this.isProcessing = false;
    this.currentOperation = null;
    this.notifyListeners();
  }
}
