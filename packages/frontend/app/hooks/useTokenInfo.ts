"use client";

import { useCallback, useEffect, useState } from "react";
import type { TokenInfoState } from "@/types/token";
import { tokenService } from "@/services/tokenService";
import { CONTRACT_ADDRESSES } from "@/config/contracts";

/**
 * Hook for managing token information
 * Provides token data, loading states, and error handling
 */
export function useTokenInfo(contractAddress?: string) {
  const [state, setState] = useState<TokenInfoState>({ status: "idle" });

  const address = contractAddress || CONTRACT_ADDRESSES.TOKEN;

  const fetchTokenInfo = useCallback(async (): Promise<void> => {
    if (!address) {
      setState({
        status: "error",
        error: "No token contract address configured"
      });
      return;
    }

    setState({ status: "loading" });

    try {
      const tokenInfo = await tokenService.getTokenInfo(address);
      setState({
        status: "success",
        data: tokenInfo
      });
    } catch (error) {
      console.error("Failed to fetch token info:", error);
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to fetch token information"
      });
    }
  }, [address]);

  const retry = useCallback(() => {
    fetchTokenInfo();
  }, [fetchTokenInfo]);

  const reset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  useEffect(() => {
    if (address && state.status === "idle") {
      fetchTokenInfo();
    }
  }, [address, fetchTokenInfo, state.status]);

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
    fetchTokenInfo,
    retry,
    reset,
    state,
  };
}

export function useDefaultTokenInfo() {
  return useTokenInfo(CONTRACT_ADDRESSES.TOKEN);
}