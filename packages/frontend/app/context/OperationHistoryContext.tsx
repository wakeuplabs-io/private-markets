'use client';

/**
 * Operation History Context
 *
 * React context for accessing operation history state across the application.
 * Provides the current state of all operations (in-progress + completed).
 */

import { createContext, useContext } from 'react';
import type { OperationHistoryState } from '@/services/operations';

/**
 * Context providing operation history state
 */
const OperationHistoryContext = createContext<OperationHistoryState | null>(null);

/**
 * Hook to access operation history
 * Must be used within OperationHistoryProvider
 *
 * @returns Current operation history state
 * @throws Error if used outside provider
 */
export function useOperationHistory(): OperationHistoryState {
  const context = useContext(OperationHistoryContext);

  if (!context) {
    throw new Error(
      'useOperationHistory must be used within OperationHistoryProvider'
    );
  }

  return context;
}

export { OperationHistoryContext };
