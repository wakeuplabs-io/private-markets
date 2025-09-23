'use client'

import React, { useState } from 'react'
import { Layout } from '@/components/layout'
import { useAdmin } from '@/hooks/useAdmin'
import { useWallet } from '@/context'
import { AdminMarket, CreateMarketFormData, CreateMarketStep } from '@/types'
import { Button } from '@/components/ui/Button'
import { useAdminMarkets } from './hooks/useAdminMarkets'
import { AdminMarketGrid } from './components/AdminMarketGrid'
import { CreateMarketModal } from './components/CreateMarketModal'
import { ReviewMarketModal } from './components/ReviewMarketModal'
import { SuccessModal } from './components/SuccessModal'

export default function AdminPage() {
  const { wallet } = useWallet()
  const { isAdmin, isLoading: adminLoading, adminUser } = useAdmin(wallet?.address)
  const { 
    filteredMarkets, 
    isLoading: marketsLoading,
    createMarket,
    resolveMarket,
  } = useAdminMarkets()

  // Modal flow state
  const [currentStep, setCurrentStep] = useState<CreateMarketStep>('form')
  const [isCreateFlowOpen, setIsCreateFlowOpen] = useState(false)
  const [formData, setFormData] = useState<CreateMarketFormData | null>(null)
  const [createdMarket, setCreatedMarket] = useState<AdminMarket | null>(null)

  if (adminLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Verificando permisos de administrador...</p>
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
            <h2 className="text-xl font-semibold text-foreground mb-2">Acceso Denegado</h2>
            <p className="text-muted-foreground mb-4">
              No tienes permisos de administrador para acceder a esta página.
            </p>
            <Button onClick={() => window.history.back()}>
              Volver
            </Button>
          </div>
        </div>
      </Layout>
    )
  }

  // Modal flow handlers
  const startCreateFlow = () => {
    setCurrentStep('form')
    setFormData(null)
    setCreatedMarket(null)
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
      const newMarket = await createMarket(formData)
      setCreatedMarket(newMarket)
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
    setCreatedMarket(null)
  }

  const handleViewMarket = () => {
    // TODO: Navigate to specific market in admin view
    handleSuccessClose()
  }

  const handleCreateAnother = () => {
    setCurrentStep('form')
    setFormData(null)
    setCreatedMarket(null)
  }

  const closeCreateFlow = () => {
    setIsCreateFlowOpen(false)
    setCurrentStep('form')
    setFormData(null)
    setCreatedMarket(null)
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

      await resolveMarket({
        marketId,
        winningOption: winningOption
      })
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
                Manage prediction markets • {adminUser?.name}
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
          onEditMarket={() => {}} // TODO: Implement edit functionality
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

            {createdMarket && (
              <SuccessModal
                isOpen={currentStep === 'success'}
                onClose={handleSuccessClose}
                onViewMarket={handleViewMarket}
                onCreateAnother={handleCreateAnother}
                createdMarket={createdMarket}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  )
}