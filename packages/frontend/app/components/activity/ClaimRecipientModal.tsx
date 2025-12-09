'use client'

import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/Fallbacks'
import { cn } from '@/lib/utils'
import { UserBet } from '@/types'
import { useAccount } from 'wagmi'
import { CheckCircle2, Wallet, Edit3 } from 'lucide-react'

interface ClaimRecipientModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (recipientAddress: string) => void
  bet: UserBet | null
  isLoading?: boolean
}

type RecipientOption = 'connected' | 'custom'

const isValidEvmAddress = (address: string): boolean => {
  if (!address) return false
  if (!address.startsWith('0x')) return false
  if (address.length !== 42) return false
  // Check if it's valid hex (after 0x)
  const hexPart = address.slice(2)
  return /^[0-9a-fA-F]+$/.test(hexPart)
}

const truncateAddress = (address: string): string => {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 10)}...${address.slice(-8)}`
}

const ClaimRecipientModal: React.FC<ClaimRecipientModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  bet,
  isLoading = false,
}) => {
  const { address: connectedAddress, isConnected } = useAccount()

  const [recipientOption, setRecipientOption] = useState<RecipientOption>('connected')
  const [customAddress, setCustomAddress] = useState('')
  const [error, setError] = useState('')

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRecipientOption(isConnected ? 'connected' : 'custom')
      setCustomAddress('')
      setError('')
    }
  }, [isOpen, isConnected])

  const validateCustomAddress = (address: string): string => {
    if (!address) return 'Address is required'
    if (!address.startsWith('0x')) return 'Address must start with 0x'
    if (address.length !== 42) return 'Address must be 42 characters'
    if (!isValidEvmAddress(address)) return 'Invalid hexadecimal address'
    return ''
  }

  const handleCustomAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCustomAddress(value)
    if (value) {
      setError(validateCustomAddress(value))
    } else {
      setError('')
    }
  }

  const handleSubmit = () => {
    let recipientAddress: string

    if (recipientOption === 'connected') {
      if (!connectedAddress) {
        setError('No wallet connected')
        return
      }
      recipientAddress = connectedAddress
    } else {
      const validation = validateCustomAddress(customAddress)
      if (validation) {
        setError(validation)
        return
      }
      recipientAddress = customAddress
    }

    onConfirm(recipientAddress)
  }

  const handleClose = () => {
    if (!isLoading) {
      setRecipientOption('connected')
      setCustomAddress('')
      setError('')
      onClose()
    }
  }

  const isValid = recipientOption === 'connected'
    ? isConnected && connectedAddress
    : customAddress && !validateCustomAddress(customAddress)

  if (!bet) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-md"
    >
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="text-left space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            Claim Reward
          </h2>
          <p className="text-sm text-muted-foreground">
            Select the Arbitrum address to receive your reward
          </p>
        </div>

        {/* Bet Info */}
        <div className="p-4 rounded-lg bg-muted space-y-3">
          <h3 className="font-semibold text-foreground text-base leading-tight">
            {bet.marketQuestion}
          </h3>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Your bet:</span>
              <span className="font-medium text-foreground">
                {bet.option === 'yes' ? 'Yes' : 'No'} - {bet.amount} tokens
              </span>
            </div>

            {bet.potentialReward && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Potential reward:</span>
                <span className="font-medium text-green-400">
                  ~{bet.potentialReward.toFixed(2)} USDC
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recipient Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Recipient Address
          </label>

          {/* Option: Connected Wallet */}
          <div
            className={cn(
              "p-4 rounded-lg border cursor-pointer transition-all",
              recipientOption === 'connected'
                ? "border-primary bg-primary/10"
                : "border-border/50 hover:border-border",
              !isConnected && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => isConnected && setRecipientOption('connected')}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                recipientOption === 'connected'
                  ? "border-primary"
                  : "border-muted-foreground"
              )}>
                {recipientOption === 'connected' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    Use connected wallet
                  </span>
                </div>
                {isConnected && connectedAddress ? (
                  <p className="text-sm text-muted-foreground mt-1 font-mono">
                    {truncateAddress(connectedAddress)}
                  </p>
                ) : (
                  <p className="text-sm text-yellow-400 mt-1">
                    No wallet connected
                  </p>
                )}
              </div>
              {recipientOption === 'connected' && isConnected && (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              )}
            </div>
          </div>

          {/* Option: Custom Address */}
          <div
            className={cn(
              "p-4 rounded-lg border transition-all",
              recipientOption === 'custom'
                ? "border-primary bg-primary/10"
                : "border-border/50 hover:border-border"
            )}
          >
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setRecipientOption('custom')}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                recipientOption === 'custom'
                  ? "border-primary"
                  : "border-muted-foreground"
              )}>
                {recipientOption === 'custom' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  Enter custom address
                </span>
              </div>
            </div>

            {recipientOption === 'custom' && (
              <div className="mt-3 pl-8">
                <input
                  type="text"
                  value={customAddress}
                  onChange={handleCustomAddressChange}
                  placeholder="0x..."
                  className={cn(
                    "w-full px-3 py-2 rounded-lg bg-background border text-foreground font-mono text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50",
                    error && customAddress
                      ? "border-red-500"
                      : "border-border/50"
                  )}
                  autoFocus
                />
                {error && customAddress && (
                  <p className="text-xs text-red-400 mt-1">{error}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            size="md"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="md"
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <LoadingState
                message="Claiming..."
                variant="minimal"
                className="justify-center"
              />
            ) : (
              'Claim Reward'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export { ClaimRecipientModal }
export type { ClaimRecipientModalProps }
