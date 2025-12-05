/**
 * PXE Manager Provider
 *
 * React Context provider for unified PXE state management.
 * Wraps the PXEManager service and provides state to React components.
 */

'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { pxeManager, type PXEManagerState } from '@/services/pxe';

/**
 * Context value type
 */
interface PXEManagerContextValue {
  state: PXEManagerState;
}

/**
 * Default context value
 */
const defaultState: PXEManagerState = {
  queue: {
    length: 0,
    currentOperation: null,
    isProcessing: false,
  },
  busy: false,
  message: 'Initializing...',
};

/**
 * Create context
 */
const PXEManagerContext = createContext<PXEManagerContextValue>({
  state: defaultState,
});

/**
 * Provider props
 */
interface PXEManagerProviderProps {
  children: ReactNode;
}

/**
 * PXE Manager Provider Component
 *
 * Subscribes to PXEManager state changes and provides them to child components.
 */
export function PXEManagerProvider({ children }: PXEManagerProviderProps) {
  const [state, setState] = useState<PXEManagerState>(() => pxeManager.getState());

  useEffect(() => {
    // Subscribe to manager state changes
    const unsubscribe = pxeManager.onStateChange((newState) => {
      setState(newState);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <PXEManagerContext.Provider value={{ state }}>
      {children}
    </PXEManagerContext.Provider>
  );
}

/**
 * Hook to access PXE Manager context
 * Use specialized hooks (usePXEManager, usePXEQueue) instead of this directly
 */
export function usePXEManagerContext(): PXEManagerContextValue {
  const context = useContext(PXEManagerContext);
  if (!context) {
    throw new Error('usePXEManagerContext must be used within PXEManagerProvider');
  }
  return context;
}
