'use client';

import React, { ReactNode } from 'react';
import { PXELoadingContextProvider, usePXELoading } from '@/context/PXELoadingContext';
import { PXELoadingModal } from '@/components/ui/PXELoadingModal';
import { useWallet } from '@/context';

interface PXELoadingProviderProps {
  children: ReactNode;
}

function PXELoadingModalWrapper() {
  const pxeState = usePXELoading();
  const { isInitializingProvider } = useWallet();

  // Extract state from PXEManagerState
  const isPXEBusy = pxeState.busy;
  const queueLength = pxeState.queue.length;
  const currentOperation = pxeState.queue.currentOperation;

  // Show modal when PXE is initializing or busy
  const isLoading = isInitializingProvider || isPXEBusy;

  // Different messages based on state
  const getLoadingInfo = () => {
    if (isInitializingProvider) {
      return {
        title: 'Initializing Aztec PXE',
        description: 'Setting up your private execution environment. This may take 10-30 seconds.',
        steps: [
          { label: 'Creating PXE service in browser' },
          { label: 'Registering contracts', delay: 'delay-75' },
          { label: 'Connecting to Aztec network', delay: 'delay-150' },
        ],
      };
    }

    if (isPXEBusy) {
      // Use currentOperation if available, otherwise use queue count
      const description = currentOperation
        ? currentOperation
        : `Processing ${queueLength > 0 ? `${queueLength} operation${queueLength > 1 ? 's' : ''}` : 'blockchain data'}...`;

      return {
        title: 'Loading Data',
        description,
        steps: [
          { label: 'Querying private state' },
          { label: 'Fetching contract data', delay: 'delay-75' },
        ],
      };
    }

    return {
      title: '',
      description: '',
      steps: [],
    };
  };

  const loadingInfo = getLoadingInfo();

  return (
    <PXELoadingModal
      isOpen={isLoading}
      title={loadingInfo.title}
      description={loadingInfo.description}
      steps={loadingInfo.steps}
    />
  );
}

export function PXELoadingProvider({ children }: PXELoadingProviderProps) {
  return (
    <PXELoadingContextProvider>
      {children}
      <PXELoadingModalWrapper />
    </PXELoadingContextProvider>
  );
}

