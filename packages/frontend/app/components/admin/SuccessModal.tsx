"use client";

import React from "react";
import { Market } from "@/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SafeRender, InvalidDataState } from "@/components/ui/Fallbacks";
import {
    isValidMarket,
    safeGetProperty,
    safeGetMarketClosingDate,
    safeFormatDate,
} from "@/utils/typeGuards";
import Image from "next/image";

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onViewMarket: () => void;
    onCreateAnother: () => void;
    createdMarket: Market | null | undefined;
    txHash?: string | null;
}

export function SuccessModal({
    isOpen,
    onClose,
    onViewMarket,
    onCreateAnother,
    createdMarket,
    txHash,
}: SuccessModalProps) {
    const formatDate = (date: Date | null | undefined): string => {
        return safeFormatDate(
            date,
            {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            },
            "TBD"
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="p-6">
                <div className="flex flex-col items-center text-center gap-6 mb-6">
                    <Image
                        src="/check.svg"
                        alt="Success"
                        width={64}
                        height={64}
                    />

                    <h2 className="text-2xl font-bold text-foreground mb-1">
                        Market Created Successfully
                    </h2>
                </div>

                <SafeRender
                    data={createdMarket}
                    validator={isValidMarket}
                    fallback={
                        <InvalidDataState
                            dataType="market"
                            onRefresh={() => window.location.reload()}
                        />
                    }
                >
                    {(validMarket) => (
                        <SuccessModalContent
                            market={validMarket}
                            formatDate={formatDate}
                            onViewMarket={onViewMarket}
                            onCreateAnother={onCreateAnother}
                            txHash={txHash}
                        />
                    )}
                </SafeRender>
            </div>
        </Modal>
    );
}

// Separate content component for better organization
interface SuccessModalContentProps {
    market: Market;
    formatDate: (date: Date | null | undefined) => string;
    onViewMarket: () => void;
    onCreateAnother: () => void;
    txHash?: string | null;
}

const SuccessModalContent: React.FC<SuccessModalContentProps> = ({
    market,
    formatDate,
    onViewMarket,
    txHash,
}) => {
    const question = safeGetProperty(market, "question", "Untitled Market");
    const closingDate = safeGetMarketClosingDate(market);

    return (
        <div className="space-y-12 mb-6">
            <div className="bg-muted rounded-lg p-4 space-y-4">
                <p className="text-foreground text-sm">{question}</p>
                <div className="flex justify-between">
                    <label className="block text-sm font-medium text-foreground mb-2">
                        Options:
                    </label>
                    <p className="text-foreground text-sm">
                        Yes / No
                    </p>
                </div>
                <div className="flex justify-between">
                    <label className="block text-sm font-medium text-foreground mb-2">
                        Closing Date:
                    </label>
                    <p className="text-foreground text-sm">
                        {formatDate(closingDate)}
                    </p>
                </div>
                {txHash && (
                    <div className="flex justify-between items-center">
                        <label className="block text-sm font-medium text-foreground">
                            Transaction:
                        </label>
                        <a
                            href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm font-mono"
                        >
                            {txHash.slice(0, 10)}...{txHash.slice(-8)}
                        </a>
                    </div>
                )}
            </div>

            <div className="flex justify-center">
                <Button type="button" onClick={onViewMarket} className="w-full">
                    Continue
                </Button>
            </div>
        </div>
    );
};
