'use client'

import React, { useState } from 'react'
import { CreateMarketFormData } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface CreateMarketModalProps {
  isOpen: boolean
  onClose: () => void
  onNext: (formData: CreateMarketFormData) => void
  initialData?: Partial<CreateMarketFormData>
}

interface FormErrors {
  question?: string
  optionYes?: string
  optionNo?: string
  closingDate?: string
}

export function CreateMarketModal({ 
  isOpen, 
  onClose, 
  onNext, 
  initialData 
}: CreateMarketModalProps) {
  const [formData, setFormData] = useState<CreateMarketFormData>({
    question: initialData?.question || '',
    optionYes: initialData?.optionYes || 'Yes',
    optionNo: initialData?.optionNo || 'No',
    closingDate: (() => {
      if (initialData?.closingDate && !isNaN(initialData.closingDate.getTime())) {
        return initialData.closingDate
      }
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow
    })(),
    disclaimer: initialData?.disclaimer || ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Validate question
    if (!formData.question.trim()) {
      newErrors.question = 'Question is required'
    } else if (formData.question.length < 10) {
      newErrors.question = 'Question must be at least 10 characters'
    } else if (formData.question.length > 200) {
      newErrors.question = 'Question cannot exceed 200 characters'
    }

    // Validate closing date
    const now = new Date()
    const closingDate = new Date(formData.closingDate)
    if (closingDate <= now) {
      newErrors.closingDate = 'Closing date must be in the future'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      // Simulate server validation
      await new Promise(resolve => setTimeout(resolve, 500))
      onNext(formData)
    } catch (error) {
      console.error('Error validating form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof CreateMarketFormData, value: string | Date) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // Clear specific error when typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }))
    }
  }

  const formatDateForInput = (date: Date): string => {
    try {
      if (!date || isNaN(date.getTime())) {
        const now = new Date()
        return now.toISOString().slice(0, 16)
      }
      return date.toISOString().slice(0, 16)
    } catch {
      console.warn('Invalid date provided to formatDateForInput:', date)
      const now = new Date()
      return now.toISOString().slice(0, 16)
    }
  }

  const handleDateChange = (value: string) => {
    try {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        handleInputChange('closingDate', date)
      }
    } catch {
      console.warn('Invalid date string provided:', value)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground mb-1">
            Set up new market
          </h2>
          <p className="text-sm text-muted-foreground">
            Once created, markets cannot be edited or deleted
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-foreground mb-2">
              Market Question *
            </label>
            <textarea
              id="question"
              value={formData.question}
              onChange={(e) => handleInputChange('question', e.target.value)}
              placeholder="Example of question that will be resolved with Yes or No?"
              className={`w-full px-3 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors bg-input text-foreground placeholder-muted-foreground ${
                errors.question
                  ? 'border-destructive bg-destructive/10'
                  : 'border-border'
              }`}
              rows={2}
              maxLength={200}
            />
            {errors.question && (
              <p className="text-sm text-destructive mt-1">{errors.question}</p>
            )}
          </div>

          <div>
            <label htmlFor="closingDate" className="block text-sm font-medium text-foreground mb-2">
              Closing date and time *
            </label>
            <input
              id="closingDate"
              type="datetime-local"
              value={formatDateForInput(formData.closingDate)}
              onChange={(e) => handleDateChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors bg-input text-foreground ${
                errors.closingDate
                  ? 'border-destructive bg-destructive/10'
                  : 'border-border'
              }`}
              min={formatDateForInput(new Date())}
            />
            {errors.closingDate && (
              <p className="text-sm text-destructive mt-1">{errors.closingDate}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              size="sm"
            >
              {isSubmitting ? 'Creating...' : 'Create Market'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
