/**
 * Operation History Types
 *
 * Type definitions for the asynchronous operation history system.
 */

/**
 * Operation status lifecycle
 */
export type OperationStatus = 'pending' | 'in-progress' | 'success' | 'error';

/**
 * Operation type categories
 */
export type OperationType = 'bet' | 'claim' | 'mint' | 'transfer' | 'query';

/**
 * Single operation record
 */
export interface Operation {
  /** Unique operation ID (UUID) */
  id: string;

  /** Human-readable description (e.g., "Placing bet", "Minting tokens") */
  description: string;

  /** Current status */
  status: OperationStatus;

  /** When operation started */
  startTime: Date;

  /** When operation completed (undefined if still in progress) */
  endTime?: Date;

  /** Error message if operation failed */
  error?: string;

  /** Optional metadata for categorization and display */
  metadata?: {
    /** Type of operation */
    type?: OperationType;

    /** Amount involved (if applicable) */
    amount?: string;

    /** Market ID (for bet/claim operations) */
    marketId?: string;

    /** Any other relevant data */
    [key: string]: unknown;
  };
}

/**
 * Operation history state
 */
export interface OperationHistoryState {
  /** All operations (max 50, FIFO eviction) */
  operations: Operation[];

  /** Currently in-progress operation (if any) */
  currentOperation: Operation | null;

  /** Number of operations currently in progress */
  inProgressCount: number;
}

/**
 * State change listener callback
 */
export type StateListener = (state: OperationHistoryState) => void;
