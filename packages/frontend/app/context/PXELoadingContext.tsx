'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { pxeQueueService, type QueueState } from '@/services/pxeQueueService';

type PXELoadingContextType = QueueState;

const PXELoadingContext = createContext<PXELoadingContextType | undefined>(undefined);

interface PXELoadingProviderProps {
  children: ReactNode;
}

export function PXELoadingContextProvider({ children }: PXELoadingProviderProps) {
  const [queueState, setQueueState] = useState<QueueState>({
    isPXEBusy: false,
    queueLength: 0,
    isProcessing: false,
  });

  useEffect(() => {
    // Subscribe to queue state changes
    const unsubscribe = pxeQueueService.subscribe((state) => {
      setQueueState(state);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <PXELoadingContext.Provider value={queueState}>
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

