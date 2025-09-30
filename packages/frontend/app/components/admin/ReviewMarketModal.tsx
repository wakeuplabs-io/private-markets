"use client";

import React, { useState } from "react";
import { CreateMarketFormData } from "@/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";

interface ReviewMarketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBack: () => void;
    onConfirm: () => Promise<void>;
    formData: CreateMarketFormData | null;
}

export function ReviewMarketModal({
    isOpen,
    onClose,
    onBack,
    onConfirm,
    formData,
}: ReviewMarketModalProps) {
    const [isCreating, setIsCreating] = useState(false);

    const handleConfirm = async () => {
        setIsCreating(true);
        try {
            await onConfirm();
        } catch (error) {
            console.error("Error al crear mercado:", error);
        } finally {
            setIsCreating(false);
        }
    };

    if (!formData) {
        return null;
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="p-8">
                <div className="mb-12">
                    <h2 className="text-2xl font-bold text-foreground mb-1">
                        Confirm New Market
                    </h2>
                    <p className="text-base text-muted-foreground">
                        You´re about to publish a new market.
                    </p>
                </div>

                <div className="space-y-4 bg-muted rounded-lg p-4">
                    <div>
                        <p className="text-foreground">{formData.question}</p>
                    </div>

                    <div className="flex justify-between">
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Options
                        </label>
                        <p className="text-foreground">Yes / No</p>
                    </div>

                    <div className="flex justify-between">
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Closing Date:
                        </label>
                        <p className="text-foreground">
                            {formatDate(formData.closingTime)}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-12 flex-nowrap">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onBack}
                        disabled={isCreating}
                        className="flex-1 w-full"
                    >
                        Back
                    </Button>

                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isCreating}
                        className="flex-1 w-full"
                    >
                        {isCreating ? "Creating..." : "Create Market"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
