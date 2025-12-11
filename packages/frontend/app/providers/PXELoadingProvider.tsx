'use client';

import React, { ReactNode } from 'react';
import { PXELoadingContextProvider } from '@/context/PXELoadingContext';
import { PXELoadingModal } from '@/components/ui/PXELoadingModal';
import { useWallet } from '@/context';

interface PXELoadingProviderProps {
  children: ReactNode;
}

function PXELoadingModalWrapper() {
  const { isInitializingProvider } = useWallet();

  // Only show modal when PXE is initializing (not for regular operations)
  // Regular operations are now handled by OperationHistoryPanel (non-blocking)
  const isLoading = isInitializingProvider;

  // Loading info only for initialization
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

