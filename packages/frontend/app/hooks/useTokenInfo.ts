"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { AztecAddress } from "@aztec/aztec.js";
import type { TokenInfoState } from "@/types/token";
import { tokenService } from "@/services/token";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { useWallet } from "@/context";
export function useTokenInfo(contractAddress?: string, includePrivateBalance = false) {
  const [state, setState] = useState<TokenInfoState>({ status: "idle" });
  const { isConnected, wallet, isInitializingProvider } = useWallet();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const address = contractAddress || CONTRACT_ADDRESSES.TOKEN;
  const ownerAddress = isConnected && wallet?.address;

  const fetchTokenInfo = useCallback(async (): Promise<void> => {
    // Don't fetch if PXE is still initializing
    if (isInitializingProvider) {
      return;
    }

    if (!address) {
      setState({ status: "error", error: "No token contract address configured" });
      return;
    }

    setState({ status: "loading" });

    try {
      const tokenInfo = await tokenService.getTokenInfo(address);

      if (includePrivateBalance && ownerAddress) {
        try {
          const aztecOwnerAddress = AztecAddress.fromString(ownerAddress);
          const privateBalance = await tokenService.getPrivateBalance(address, aztecOwnerAddress);
          tokenInfo.privateBalance = privateBalance;
        } catch {
          // Silently ignore balance errors
        }
      }

      setState({ status: "success", data: tokenInfo });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to fetch token information"
      });
    }
  }, [address, includePrivateBalance, ownerAddress, isInitializingProvider]);

  // Fetch initial data with debounce
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (address && state.status === "idle" && !isInitializingProvider) {
      // Debounce fetch by 200ms
      debounceTimerRef.current = setTimeout(() => {
        fetchTokenInfo();
      }, 200);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [address, fetchTokenInfo, state.status, isInitializingProvider]);

  // Refetch when wallet connects and we want private balance
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (address && includePrivateBalance && isConnected && ownerAddress && !isInitializingProvider) {
      // Debounce fetch by 200ms
      debounceTimerRef.current = setTimeout(() => {
        fetchTokenInfo();
      }, 200);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [address, includePrivateBalance, isConnected, ownerAddress, fetchTokenInfo, isInitializingProvider]);

  const retry = useCallback(() => fetchTokenInfo(), [fetchTokenInfo]);
  const reset = useCallback(() => setState({ status: "idle" }), []);

  const isLoading = state.status === "loading";
  const isError = state.status === "error";
  const isSuccess = state.status === "success";
  const tokenInfo = isSuccess ? state.data : undefined;
  const error = isError ? state.error : undefined;

  return {
    tokenInfo,
    isLoading,
    isError,
    isSuccess,
    error,
    retry,
    reset,
    refetch: fetchTokenInfo,
  };
}

export function useDefaultTokenInfo(includePrivateBalance = true) {
  return useTokenInfo(CONTRACT_ADDRESSES.TOKEN, includePrivateBalance);
}