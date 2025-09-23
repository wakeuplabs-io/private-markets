'use client'

import React, { useState } from 'react'
import { Layout } from '@/components/layout'
import { useAdmin } from '@/hooks/useAdmin'
import { useWallet } from '@/context'
import { CreateMarketFormData, CreateMarketStep } from '@/types'
import { Button } from '@/components/ui/Button'
import { useAdminMarkets } from '@/hooks/useAdminMarkets'
import { AdminMarketGrid } from './components/AdminMarketGrid'
import { CreateMarketModal } from './components/CreateMarketModal'
import { ReviewMarketModal } from './components/ReviewMarketModal'
import { SuccessModal } from './components/SuccessModal'

export default function AdminPage() {
  const { wallet } = useWallet()
  const { isAdmin, isLoading: adminLoading } = useAdmin(wallet?.address)
  const {
    markets: filteredMarkets,
    isLoading: marketsLoading,
    createMarket,
    resolveMarket,
  } = useAdminMarkets()

  // Modal flow state
  const [currentStep, setCurrentStep] = useState<CreateMarketStep>('form')
  const [isCreateFlowOpen, setIsCreateFlowOpen] = useState(false)
  const [formData, setFormData] = useState<CreateMarketFormData | null>(null)

  if (adminLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Verifying admin permissions...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!isAdmin && false) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You do not have admin permissions to access this page.
            </p>
            <Button onClick={() => window.history.back()}>
              Back
            </Button>
          </div>
        </div>
      </Layout>
    )
  }

  const startCreateFlow = () => {
    setCurrentStep('form')
    setFormData(null)
    setIsCreateFlowOpen(true)
  }

  const handleFormNext = (data: CreateMarketFormData) => {
    setFormData(data)
    setCurrentStep('review')
  }

  const handleReviewBack = () => {
    setCurrentStep('form')
  }

  const handleConfirmCreate = async () => {
    if (!formData) return

    try {
      await createMarket(formData)
      setCurrentStep('success')
    } catch (error) {
      console.error('Error creating market:', error)
      setCurrentStep('error')
    }
  }

  const handleSuccessClose = () => {
    setIsCreateFlowOpen(false)
    setCurrentStep('form')
    setFormData(null)
  }

  const handleViewMarket = () => {
    handleSuccessClose()
  }

  const handleCreateAnother = () => {
    setCurrentStep('form')
    setFormData(null)
  }

  const closeCreateFlow = () => {
    setIsCreateFlowOpen(false)
    setCurrentStep('form')
    setFormData(null)
  }

  const handleResolveMarket = async (marketId: string, winningOption: 'yes' | 'no') => {
    try {
      const market = filteredMarkets.find(m => m.id === marketId)
      if (!market) return

      const winningOptionData = market.options.find(o => 
        (winningOption === 'yes' && o.id === 'yes') || 
        (winningOption === 'no' && o.id === 'no')
      )

      if (!winningOptionData) return

      await resolveMarket(marketId, winningOption)
    } catch (error) {
      console.error('Error resolving market:', error)
    }
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Market Administration
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage prediction markets • Admin
              </p>
            </div>
            <Button onClick={startCreateFlow}>
              + Create Market
            </Button>
          </div>
        </div>

        <AdminMarketGrid
          markets={filteredMarkets}
          isLoading={marketsLoading}
          onCreateMarket={startCreateFlow}
          onResolveMarket={handleResolveMarket}
          onEditMarket={() => {}}
        />

        {isCreateFlowOpen && (
          <>
            <CreateMarketModal
              isOpen={currentStep === 'form'}
              onClose={closeCreateFlow}
              onNext={handleFormNext}
              initialData={formData || undefined}
            />

            {formData && (
              <ReviewMarketModal
                isOpen={currentStep === 'review'}
                onClose={closeCreateFlow}
                onBack={handleReviewBack}
                onConfirm={handleConfirmCreate}
                formData={formData}
              />
            )}

            {formData && currentStep === 'success' && (
              <SuccessModal
                isOpen={currentStep === 'success'}
                onClose={handleSuccessClose}
                onViewMarket={handleViewMarket}
                onCreateAnother={handleCreateAnother}
                createdMarket={{
                  id: '0',
                  question: formData.question,
                  status: 'open' as const,
                  options: [
                    { id: 'yes', name: 'Yes', odds: 2.0 },
                    { id: 'no', name: 'No', odds: 2.0 }
                  ],
                  chancePercentage: 50,
                  createdAt: new Date()
                }}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  )
}