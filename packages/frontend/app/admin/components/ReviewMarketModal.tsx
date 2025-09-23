'use client'

import React, { useState } from 'react'
import { CreateMarketFormData } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface ReviewMarketModalProps {
  isOpen: boolean
  onClose: () => void
  onBack: () => void
  onConfirm: () => Promise<void>
  formData: CreateMarketFormData
}

export function ReviewMarketModal({ 
  isOpen, 
  onClose, 
  onBack, 
  onConfirm, 
  formData 
}: ReviewMarketModalProps) {
  const [isCreating, setIsCreating] = useState(false)

  const handleConfirm = async () => {
    setIsCreating(true)
    try {
      await onConfirm()
    } catch (error) {
      console.error('Error al crear mercado:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground mb-1">
            Confirm New Market
          </h2>
          <p className="text-sm text-muted-foreground">
            Review the market details before creating
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Market Question
            </label>
            <p className="text-foreground p-3 bg-muted rounded-lg">
              {formData.question}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Options
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-border bg-input rounded-lg p-3">
                <span className="text-sm font-medium text-foreground">
                  {formData.optionYes}
                </span>
              </div>
              <div className="border border-border bg-input rounded-lg p-3">
                <span className="text-sm font-medium text-foreground">
                  {formData.optionNo}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Closing Date
            </label>
            <p className="text-foreground p-3 bg-muted rounded-lg">
              {formatDate(formData.closingDate)}
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={onBack}
            disabled={isCreating}
            size="sm"
          >
            Back
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isCreating}
            size="sm"
          >
            {isCreating ? 'Creating...' : 'Create Market'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
