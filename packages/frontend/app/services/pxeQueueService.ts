/**
 * PXE Queue Service
 * 
 * Manages a queue for PXE operations to prevent concurrent execution issues.
 * The Aztec PXE doesn't support concurrent operations, so we need to serialize them.
 * 
 * This service:
 * - Maintains a queue of pending PXE operations
 * - Executes operations sequentially
 * - Emits events when the queue state changes
 * - Provides current state (busy/idle)
 */

type QueueListener = (state: QueueState) => void;

export interface QueueState {
  isPXEBusy: boolean;
  queueLength: number;
  isProcessing: boolean;
}

class PXEQueueService {
  private static instance: PXEQueueService;
  private queue: Array<() => Promise<unknown>> = [];
  private isProcessing = false;
  private listeners: Set<QueueListener> = new Set();

  private constructor() {}

  static getInstance(): PXEQueueService {
    if (!PXEQueueService.instance) {
      PXEQueueService.instance = new PXEQueueService();
    }
    return PXEQueueService.instance;
  }

  /**
   * Subscribe to queue state changes
   */
  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.getState());

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current queue state
   */
  getState(): QueueState {
    return {
      isPXEBusy: this.isProcessing || this.queue.length > 0,
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Enqueue a PXE operation
   * Returns a promise that resolves when the operation completes
   */
  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Add operation to queue
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
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
          console.error('[PXEQueue] Operation failed:', error);
          // Continue processing even if one operation fails
        }
        this.notifyListeners();
      }
    }

    this.isProcessing = false;
    this.notifyListeners();
  }

  /**
   * Clear the queue (useful for cleanup/testing)
   */
  clear(): void {
    this.queue = [];
    this.isProcessing = false;
    this.notifyListeners();
  }
}

/**
 * Singleton instance export
 */
export const pxeQueueService = PXEQueueService.getInstance();

