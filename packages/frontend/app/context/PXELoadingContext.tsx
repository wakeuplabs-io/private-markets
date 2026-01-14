'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { pxeManager, type PXEManagerState } from '@/services/pxe';

type PXELoadingContextType = PXEManagerState;

const PXELoadingContext = createContext<PXELoadingContextType | undefined>(undefined);

interface PXELoadingProviderProps {
  children: ReactNode;
}

export function PXELoadingContextProvider({ children }: PXELoadingProviderProps) {
  const [managerState, setManagerState] = useState<PXEManagerState>(pxeManager.getState());

  useEffect(() => {
    // Subscribe to manager state changes
    const unsubscribe = pxeManager.onStateChange((state) => {
      setManagerState(state);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <PXELoadingContext.Provider value={managerState}>
      {children}
    </PXELoadingContext.Provider>
  );
}

export function usePXELoading(): PXELoadingContextType {
  const context = useContext(PXELoadingContext);
  if (context === undefined) {
    throw new Error('usePXELoading must be used within a PXELoadingContextProvider');
  }
  return context;
}

