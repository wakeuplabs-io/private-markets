"use client";

import React, { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { CreateMarketFormData, CreateMarketStep, Market } from "@/types";
import { Button } from "@/components/ui/Button";
import { useAdminMarkets } from "@/hooks/useAdminMarkets";
import { AdminMarketGrid } from "./AdminMarketGrid";
import { CreateMarketModal } from "./CreateMarketModal";
import { ReviewMarketModal } from "./ReviewMarketModal";
import { SuccessModal } from "./SuccessModal";

export function AdminPage() {
    const { isLoading: adminLoading } = useAdmin();
    const {
        markets: filteredMarkets,
        isLoading: marketsLoading,
        createMarket,
        resolveMarket,
    } = useAdminMarkets();

    const [currentStep, setCurrentStep] = useState<CreateMarketStep | null>(
        null
    );
    const [createMarketFormData, setCreateMarketFormData] =
        useState<CreateMarketFormData | null>(null);
    const [createdMarket, setCreatedMarket] = useState<Market | null>(null);

    const isLoading = adminLoading || marketsLoading;

    if (isLoading) {
        return (
            <div className="container mx-auto px-8 py-16">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-muted-foreground">
                            Loading admin panel...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const handleCreateMarket = () => {
        setCurrentStep("form");
    };

    const handleFormSubmit = (formData: CreateMarketFormData) => {
        setCreateMarketFormData(formData);
        setCurrentStep("review");
    };

    const handleConfirmMarket = async () => {
        if (!createMarketFormData) return;

        try {
            await createMarket(createMarketFormData);
            // En un escenario real, obtendríamos el market creado de la respuesta
            const mockCreatedMarket: Market = {
                id: Date.now().toString(),
                question: createMarketFormData.question,
                options: [
                    { id: "yes", name: "Yes", odds: 1.5 },
                    { id: "no", name: "No", odds: 2.0 },
                ],
                status: "open",
                createdAt: new Date(),
                closingDate: createMarketFormData.closingTime,
            };
            setCreatedMarket(mockCreatedMarket);
            setCurrentStep("success");
        } catch (error) {
            console.error("Failed to create market:", error);
            setCurrentStep("error");
        }
    };

    const handleCloseModal = () => {
        setCurrentStep(null);
        setCreateMarketFormData(null);
        setCreatedMarket(null);
    };

    return (
        <>
            <div className="container mx-auto px-8 py-8">
                <div className="flex justify-between items-center mb-8">
                    <div className="mb-2">
                        <h1 className="heading-h1">
                            Market Management
                        </h1>
                        <p className="text-muted-foreground"></p>
                    </div>
                    <Button
                        onClick={handleCreateMarket}
                        className="bg-primary hover:bg-primary/90"
                    >
                        Create Market
                    </Button>
                </div>

                <AdminMarketGrid
                    markets={filteredMarkets}
                    isLoading={marketsLoading}
                    onCreateMarket={handleCreateMarket}
                    onResolveMarket={async (
                        marketId: string,
                        winningOption: "yes" | "no"
                    ) => {
                        await resolveMarket(marketId, winningOption);
                    }}
                />

                <CreateMarketModal
                    isOpen={currentStep === "form"}
                    onClose={handleCloseModal}
                    onNext={handleFormSubmit}
                />

                <ReviewMarketModal
                    isOpen={currentStep === "review"}
                    onClose={handleCloseModal}
                    onBack={() => setCurrentStep("form")}
                    onConfirm={handleConfirmMarket}
                    formData={createMarketFormData!}
                />

                <SuccessModal
                    isOpen={currentStep === "success"}
                    onClose={handleCloseModal}
                    onViewMarket={() => {
                        // Navegar al market creado
                        console.log("Navigate to market:", createdMarket?.id);
                        handleCloseModal();
                    }}
                    onCreateAnother={() => {
                        setCreateMarketFormData(null);
                        setCreatedMarket(null);
                        setCurrentStep("form");
                    }}
                    createdMarket={createdMarket!}
                />
            </div>
        </>
    );
}
