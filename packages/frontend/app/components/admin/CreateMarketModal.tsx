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
  closingTime?: string
}

export function CreateMarketModal({
  isOpen,
  onClose,
  onNext,
  initialData
}: CreateMarketModalProps) {
  const [formData, setFormData] = useState<CreateMarketFormData>({
    question: initialData?.question || '',
    closingTime: initialData?.closingTime || new Date(Date.now() + 24 * 60 * 60 * 1000) // Default: 24 hours from now
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.question.trim()) {
      newErrors.question = 'Question is required'
    } else if (formData.question.length < 10) {
      newErrors.question = 'Question must be at least 10 characters'
    } else if (formData.question.length > 200) {
      newErrors.question = 'Question cannot exceed 200 characters'
    }

    const now = new Date()
    const minClosingTime = new Date(now.getTime() + 1 * 60 * 1000)

    if (formData.closingTime <= now) {
      newErrors.closingTime = 'Closing time must be in the future'
    } else if (formData.closingTime < minClosingTime) {
      newErrors.closingTime = 'Closing time must be at least 1 minute from now'
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
      await new Promise(resolve => setTimeout(resolve, 500))
      onNext(formData)
    } catch (error) {
      console.error('Error validating form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuestionChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      question: value
    }))

    if (errors.question) {
      setErrors(prev => ({
        ...prev,
        question: undefined
      }))
    }
  }

  const handleClosingTimeChange = (value: string) => {
    if (!value) return

    // Parse the datetime-local value properly to avoid timezone conversion issues
    // The value comes as "YYYY-MM-DDTHH:mm" and we want to create a Date
    // that represents this exact date/time in the user's local timezone
    const [datePart, timePart] = value.split('T')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hours, minutes] = timePart.split(':').map(Number)

    // Create date using local timezone (not UTC)
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0)

    setFormData(prev => ({
      ...prev,
      closingTime: date
    }))

    if (errors.closingTime) {
      setErrors(prev => ({
        ...prev,
        closingTime: undefined
      }))
    }
  }

  // Helper function to format date for datetime-local input (preserving local timezone)
  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Helper function to get current timezone name
  const getCurrentTimezone = (): string => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
      return 'Local Time'
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground mb-1">
            Create New Market
          </h2>
          <p className="text-sm text-muted-foreground">
            Create a binary prediction market (Yes/No outcomes)
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
              onChange={(e) => handleQuestionChange(e.target.value)}
              placeholder="Example: Will Bitcoin reach $100,000 by the end of 2025?"
              className={`w-full px-3 py-2 rounded-lg resize-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors bg-input text-foreground placeholder-muted-foreground ${
                errors.question
                  ? 'border border-destructive bg-destructive/10'
                  : 'border-none'
              }`}
              rows={3}
              maxLength={200}
            />
            {errors.question && (
              <p className="text-destructive text-sm mt-1">{errors.question}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {formData.question.length}/200 characters
            </p>
          </div>

          <div>
            <label htmlFor="closingTime" className="block text-sm font-medium text-foreground mb-2">
              Market Closing Time *
            </label>
            <input
              id="closingTime"
              type="datetime-local"
              value={formatDateTimeLocal(formData.closingTime)}
              onChange={(e) => handleClosingTimeChange(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors bg-input text-foreground ${
                errors.closingTime
                  ? 'border border-destructive bg-destructive/10'
                  : 'border-none'
              }`}
              min={formatDateTimeLocal(new Date(Date.now() + 5 * 60 * 1000))}
            />
            {errors.closingTime && (
              <p className="text-destructive text-sm mt-1">{errors.closingTime}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              When betting will close for this market ({getCurrentTimezone()}). Must be in the future.
            </p>
            <p className="text-xs text-muted-foreground">
              Selected time: {formData.closingTime.toLocaleString()}
            </p>
          </div>

          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="text-sm font-medium text-foreground mb-2">Market Details</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Options:</span>
                <span>Yes / No (automatic)</span>
              </div>
              <div className="flex justify-between">
                <span>Market Type:</span>
                <span>Binary Prediction</span>
              </div>
              <div className="flex justify-between">
                <span>Resolution:</span>
                <span>Manual by admin</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Market'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}