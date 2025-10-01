import { useState, useCallback } from 'react';
import { vaultService } from '@/services/vault';

interface UseBetResult {
  placeBet: (params: {
    marketId: string;
    outcome: number;
    amount: number;
    userAddress: string;
  }) => Promise<string>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useVault(): UseBetResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeBet = useCallback(async (params: {
    marketId: string;
    outcome: number;
    amount: number;
    userAddress: string;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      const txHash = await vaultService.placeBet(params);
      return txHash;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    placeBet,
    isLoading,
    error,
    clearError
  };
}