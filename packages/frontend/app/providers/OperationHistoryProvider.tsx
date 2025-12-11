'use client';

/**
 * Operation History Provider
 *
 * React provider that wraps the app and provides operation history state
 * via React Context. Subscribes to OperationHistoryManager and updates
 * React state accordingly.
 */

import React, { useEffect, useState, type ReactNode } from 'react';
import { OperationHistoryContext } from '@/context/OperationHistoryContext';
import { operationHistoryManager } from '@/services/operations';
import type { OperationHistoryState } from '@/services/operations';

interface OperationHistoryProviderProps {
  children: ReactNode;
}

/**
 * Provider component for operation history
 *
 * Usage:
 * ```tsx
 * <OperationHistoryProvider>
 *   <App />
 * </OperationHistoryProvider>
 * ```
 */
export function OperationHistoryProvider({ children }: OperationHistoryProviderProps) {
  const [state, setState] = useState<OperationHistoryState>(
    operationHistoryManager.getState()
  );

  useEffect(() => {
    // Subscribe to state changes from manager
    const unsubscribe = operationHistoryManager.onStateChange(setState);

    // Cleanup on unmount
    return unsubscribe;
  }, []);

  return (
    <OperationHistoryContext.Provider value={state}>
      {children}
    </OperationHistoryContext.Provider>
  );
}
