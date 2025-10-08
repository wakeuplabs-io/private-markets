"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { useAccount } from "wagmi";
import { MarketService } from "@/services/marketService";
import {
    Market,
    CreateMarketFormData,
    BlockchainConnectionStatus,
} from "@/types";

interface UseAdminMarketsReturn {
    markets: Market[];
    isLoading: boolean;
    error: string | null;
    connectionStatus: BlockchainConnectionStatus;
    createMarket: (formData: CreateMarketFormData) => Promise<void>;
    resolveMarket: (
        marketId: string,
        winningOption: "yes" | "no"
    ) => Promise<void>;
}

const fetchAdminData = async (): Promise<{
    markets: Market[];
    connectionStatus: BlockchainConnectionStatus;
}> => {
    try {
        const blockchainStatus = await MarketService.getConnectionStatus();
        console.log("Blockchain status:", blockchainStatus);
        const adminMarkets = await MarketService.getAdminMarkets();
        console.log("Admin markets:", adminMarkets);
        return {
            markets: adminMarkets,
            connectionStatus: blockchainStatus,
        };
    } catch (error) {
        console.error("Error loading admin data:", error);
        throw error;
    }
};

export function useAdminMarkets(): UseAdminMarketsReturn {
    const [connectionStatus, setConnectionStatus] =
        useState<BlockchainConnectionStatus>("connecting");
    const { isConnected } = useAccount();

    const {
        data: adminData,
        error,
        isLoading,
        mutate,
    } = useSWR(isConnected ? "admin-markets" : null, fetchAdminData, {
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        errorRetryCount: 3,
        onError: (err) => {
            console.error("Error loading admin data:", err);
            setConnectionStatus("error");
        },
        onSuccess: (data) => {
            setConnectionStatus(data.connectionStatus);
        },
    });

    const createMarket = useCallback(
        async (formData: CreateMarketFormData) => {
            try {
                const hash = await MarketService.createMarket(
                    formData.question,
                    formData.closingTime
                );
                console.log("Market creation transaction:", hash);

                await mutate();
            } catch (err) {
                const errorMessage =
                    err instanceof Error
                        ? err.message
                        : "Failed to create market";
                throw new Error(errorMessage);
            }
        },
        [mutate]
    );

    const resolveMarket = useCallback(
        async (marketId: string, winningOption: "yes" | "no") => {
            try {
                const hash = await MarketService.resolveMarket(
                    Number(marketId),
                    winningOption
                );
                console.log("Market resolution transaction:", hash);

                await mutate();
            } catch (err) {
                const errorMessage =
                    err instanceof Error
                        ? err.message
                        : "Failed to resolve market";
                throw new Error(errorMessage);
            }
        },
        [mutate]
    );

    const errorMessage = error
        ? error instanceof Error
            ? error.message
            : "Failed to load admin data"
        : !isConnected
        ? "Please connect your wallet to view admin data"
        : null;

    return {
        markets: adminData?.markets || [],
        isLoading,
        error: errorMessage,
        connectionStatus,
        createMarket,
        resolveMarket,
    };
}
