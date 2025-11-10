/**
 * PXE Manager Provider
 *
 * React Context provider for unified PXE state management.
 * Wraps the PXEManager service and provides state to React components.
 */

'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { pxeManager, type PXEManagerState } from '@/services/pxeManager';

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
  sync: {
    synced: false,
    syncing: false,
    currentBlock: 0,
    targetBlock: 0,
    progress: 0,
    lastError: null,
    lastSyncTime: 0,
  },
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
    console.log('[PXEManagerProvider] Subscribing to state changes');

    // Subscribe to manager state changes
    const unsubscribe = pxeManager.onStateChange((newState) => {
      console.log('[PXEManagerProvider] State update received:', newState);
      setState(newState);
    });

    // Cleanup on unmount
    return () => {
      console.log('[PXEManagerProvider] Unsubscribing from state changes');
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
 * Use specialized hooks (usePXEManager, usePXESync, usePXEQueue) instead of this directly
 */
export function usePXEManagerContext(): PXEManagerContextValue {
  const context = useContext(PXEManagerContext);
  if (!context) {
    throw new Error('usePXEManagerContext must be used within PXEManagerProvider');
  }
  return context;
}
