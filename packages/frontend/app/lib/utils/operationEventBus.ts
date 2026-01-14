/**
 * Operation Event Bus
 *
 * Simple event emitter for decoupling operation execution from UI updates.
 * Uses Observer pattern to allow multiple listeners for operation lifecycle events.
 */

export type OperationEventType = 'START' | 'PROGRESS' | 'SUCCESS' | 'ERROR' | 'COMPLETE';

export interface OperationEvent {
  type: OperationEventType;
  operationId: string;
  timestamp: Date;
  data?: unknown;
}

type EventListener = (event: OperationEvent) => void;

/**
 * Event bus for operation lifecycle events
 *
 * Events:
 * - START: Operation added to queue and started
 * - PROGRESS: Operation progress update (optional)
 * - SUCCESS: Operation completed successfully
 * - ERROR: Operation failed with error
 * - COMPLETE: Operation finished (success or error)
 */
class OperationEventBus {
  private listeners: Map<OperationEventType, Set<EventListener>>;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to specific event type
   * @param type - Event type to listen for
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  on(type: OperationEventType, listener: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(listener);

    // Return unsubscribe function
    return () => this.off(type, listener);
  }

  /**
   * Emit event to all listeners of that type
   * @param event - Event to emit
   */
  emit(event: OperationEvent): void {
    const listeners = this.listeners.get(event.type);

    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });
    }
  }

  /**
   * Unsubscribe from specific event type
   * @param type - Event type
   * @param listener - Listener to remove
   */
  off(type: OperationEventType, listener: EventListener): void {
    const listeners = this.listeners.get(type);

    if (listeners) {
      listeners.delete(listener);

      // Clean up empty sets
      if (listeners.size === 0) {
        this.listeners.delete(type);
      }
    }
  }

  /**
   * Remove all listeners (useful for testing)
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Get number of listeners for a specific event type
   * @param type - Event type
   * @returns Number of listeners
   */
  listenerCount(type: OperationEventType): number {
    return this.listeners.get(type)?.size || 0;
  }
}

// Singleton instance
export const operationEventBus = new OperationEventBus();
