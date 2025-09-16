"use client";

import { useCallback, useState } from "react";
import { AztecAddress } from "@aztec/aztec.js";
import type { TokenActions, TokenActionsState } from "@/types/token";
import { tokenService } from "@/services/tokenService";
import { CONTRACT_ADDRESSES } from "@/config/contracts";

/**
 * Hook for managing token actions (mint, refresh balance)
 * Provides loading states and error handling for token operations
 */
export function useTokenActions(contractAddress?: string) {
  const [state, setState] = useState<TokenActionsState>({
    isMinting: false,
    isRefreshing: false,
  });

  const address = contractAddress || CONTRACT_ADDRESSES.TOKEN;

  const mintToPrivate = useCallback(async (recipient: AztecAddress, amount: bigint): Promise<string> => {
    if (!address) {
      throw new Error("No token contract address configured");
    }

    setState(prev => ({
      ...prev,
      isMinting: true,
      mintError: undefined
    }));

    try {
      const txHash = await tokenService.mintToPrivate(address, recipient, amount);

      setState(prev => ({
        ...prev,
        isMinting: false,
        lastTxHash: txHash
      }));

      return txHash;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to mint tokens";

      setState(prev => ({
        ...prev,
        isMinting: false,
        mintError: errorMessage
      }));

      throw error;
    }
  }, [address]);

  const refreshBalance = useCallback(async (): Promise<void> => {
    if (!address) {
      throw new Error("No token contract address configured");
    }

    setState(prev => ({
      ...prev,
      isRefreshing: true,
      balanceError: undefined
    }));

    try {
      tokenService.clearCache();

      setState(prev => ({
        ...prev,
        isRefreshing: false
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to refresh balance";

      setState(prev => ({
        ...prev,
        isRefreshing: false,
        balanceError: errorMessage
      }));

      throw error;
    }
  }, [address]);

  const clearErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      mintError: undefined,
      balanceError: undefined
    }));
  }, []);

  const clearTxHash = useCallback(() => {
    setState(prev => ({
      ...prev,
      lastTxHash: undefined
    }));
  }, []);

  const actions: TokenActions = {
    mintToPrivate,
    refreshBalance,
  };

  return {
    actions,
    state,
    clearErrors,
    clearTxHash,
    isMinting: state.isMinting,
    isRefreshing: state.isRefreshing,
    mintError: state.mintError,
    balanceError: state.balanceError,
    lastTxHash: state.lastTxHash,
  };
}

export function useDefaultTokenActions() {
  return useTokenActions(CONTRACT_ADDRESSES.TOKEN);
}