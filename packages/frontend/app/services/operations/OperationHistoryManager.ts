/**
 * Operation History Manager
 *
 * Singleton service managing operation history state.
 * Tracks all operations (in-progress + completed) with timestamps and status.
 */

import type { Operation, OperationHistoryState, StateListener } from './types';

class OperationHistoryManager {
  private static instance: OperationHistoryManager;
  private operations: Operation[] = [];
  private listeners: Set<StateListener> = new Set();
  private readonly MAX_OPERATIONS = 50;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): OperationHistoryManager {
    if (!OperationHistoryManager.instance) {
      OperationHistoryManager.instance = new OperationHistoryManager();
    }
    return OperationHistoryManager.instance;
  }


  /**
   * Add new operation to history
   * Checks for duplicates: if an operation with same description is already in-progress or pending, returns existing ID
   * @param description - Human-readable description
   * @param metadata - Optional metadata
   * @returns Operation ID (new or existing)
   */
  addOperation(description: string, metadata?: Operation['metadata']): string {
    // Check if operation with same description is already in progress or pending
    const existingOperation = this.operations.find(
      op =>
        op.description === description &&
        (op.status === 'in-progress' || op.status === 'pending')
    );

    if (existingOperation) {
      return existingOperation.id;
    }

    const operation: Operation = {
      id: this.generateId(),
      description,
      status: 'pending',
      startTime: new Date(),
      metadata,
    };

    this.operations.push(operation);
    this.evictOldOperations();
    this.notifyListeners();

    return operation.id;
  }

  /**
   * Update existing operation
   * @param id - Operation ID
   * @param updates - Partial updates to apply
   */
  updateOperation(id: string, updates: Partial<Operation>): void {
    const operation = this.operations.find(op => op.id === id);

    if (!operation) {
      console.warn(`[OperationHistory] Operation ${id} not found`);
      return;
    }

    Object.assign(operation, updates);
    this.notifyListeners();
  }

  /**
   * Get operation by ID
   * @param id - Operation ID
   * @returns Operation or undefined
   */
  getOperation(id: string): Operation | undefined {
    return this.operations.find(op => op.id === id);
  }

  /**
   * Get all operations
   * @returns Copy of operations array
   */
  getHistory(): Operation[] {
    return [...this.operations];
  }

  /**
   * Clear all completed/failed operations
   * Keeps in-progress operations
   */
  clearHistory(): void {
    this.operations = this.operations.filter(
      op => op.status === 'in-progress' || op.status === 'pending'
    );
    this.notifyListeners();
  }

  /**
   * Clear all operations (use with caution)
   */
  clearAll(): void {
    this.operations = [];
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  onStateChange(listener: StateListener): () => void {
    this.listeners.add(listener);

    // Immediately call with current state
    listener(this.getState());

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current state
   * @returns Current operation history state
   */
  getState(): OperationHistoryState {
    const inProgressOps = this.operations.filter(op => op.status === 'in-progress');

    return {
      operations: [...this.operations],
      currentOperation: inProgressOps[0] || null,
      inProgressCount: inProgressOps.length,
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();

    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('[OperationHistory] Error in listener:', error);
      }
    });
  }

  /**
   * Evict old operations to maintain max limit
   * Removes oldest completed/failed operations first
   */
  private evictOldOperations(): void {
    if (this.operations.length <= this.MAX_OPERATIONS) {
      return;
    }

    // Sort by priority: keep in-progress, then most recent
    const sorted = [...this.operations].sort((a, b) => {
      // In-progress operations have highest priority
      if (a.status === 'in-progress' && b.status !== 'in-progress') return -1;
      if (a.status !== 'in-progress' && b.status === 'in-progress') return 1;

      // Pending operations have second priority
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;

      // Otherwise sort by start time (most recent first)
      return b.startTime.getTime() - a.startTime.getTime();
    });

    // Keep only MAX_OPERATIONS
    this.operations = sorted.slice(0, this.MAX_OPERATIONS);
  }

  /**
   * Generate unique operation ID
   * @returns UUID-like string
   */
  private generateId(): string {
    // Simple UUID v4 implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Export singleton instance
export const operationHistoryManager = OperationHistoryManager.getInstance();
