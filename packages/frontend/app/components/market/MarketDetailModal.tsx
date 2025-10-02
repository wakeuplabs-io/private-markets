"use client";

import React, { useState } from "react";
import { CreateMarketFormData, Market, UserBet } from "@/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";

interface MarketDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBack: () => void;
    market: Market | null;
    bets: UserBet[] | null;
}

export function MarketDetailModal({
    isOpen,
    onClose,
    onBack,
    market,
    bets,
}: MarketDetailModalProps) {
    if (!market) {
        return null;
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="p-8">
                <div className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-1">
                        {market.question}
                    </h2>
                    <p className="text-base text-muted-foreground">
                        Recent actions for this market. No stakes or addresses
                        are shown.{" "}
                    </p>
                </div>

                <div className="space-y-4 bg-muted rounded-lg p-4">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-2">
                            <p className="text-foreground">Date</p>
                        </div>
                        <div className="col-span-1">Bet placed</div>
                        <div className="col-span-1">Tx</div>
                        {bets?.map((bet) => (
                            <div key={bet.id}>
                                <p className="text-foreground">{formatDate(bet.placedAt)}</p>
                                <p className="text-foreground">{bet.amount}</p>
                                <p className="text-foreground">{bet.txHash}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-12 flex-nowrap">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onBack}
                        className="flex-1 w-full"
                    >
                        Back
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
