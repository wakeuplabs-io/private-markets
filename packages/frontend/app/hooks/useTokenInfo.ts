"use client";

import { useCallback, useEffect, useState } from "react";
import { AztecAddress } from "@aztec/aztec.js";
import type { TokenInfoState } from "@/types/token";
import { tokenService } from "@/services/token";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { useWallet } from "@/context";
export function useTokenInfo(contractAddress?: string, includePrivateBalance = false) {
  const [state, setState] = useState<TokenInfoState>({ status: "idle" });
  const { isConnected, wallet } = useWallet();

  const address = contractAddress || CONTRACT_ADDRESSES.TOKEN;
  const ownerAddress = isConnected && wallet?.address;

  const fetchTokenInfo = useCallback(async (): Promise<void> => {
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
  }, [address, includePrivateBalance, ownerAddress]);

  // Fetch initial data
  useEffect(() => {
    if (address && state.status === "idle") {
      fetchTokenInfo();
    }
  }, [address, fetchTokenInfo, state.status]);

  // Refetch when wallet connects and we want private balance
  useEffect(() => {
    if (address && includePrivateBalance && isConnected && ownerAddress) {
      fetchTokenInfo();
    }
  }, [address, includePrivateBalance, isConnected, ownerAddress, fetchTokenInfo]);

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