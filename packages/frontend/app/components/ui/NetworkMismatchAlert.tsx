'use client'

import React from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { arbitrumSepolia } from 'viem/chains'
import { Button } from './Button'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NetworkMismatchAlertProps {
  className?: string
}

export function NetworkMismatchAlert({ className }: NetworkMismatchAlertProps) {
  const { chain } = useAccount()
  const { switchChain, isPending } = useSwitchChain()

  // Only show if connected to wrong chain
  if (!chain || chain.id === arbitrumSepolia.id) {
    return null
  }

  const handleSwitchChain = async () => {
    try {
      await switchChain({ chainId: arbitrumSepolia.id })
    } catch (error) {
      console.error('Failed to switch chain:', error)
    }
  }

  const getChainName = (chainId: number) => {
    switch (chainId) {
      case 1: return 'Ethereum Mainnet'
      case 421614: return 'Arbitrum Sepolia'
      default: return `Chain ${chainId}`
    }
  }

  return (
    <div className={cn(
      'bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3',
      className
    )}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <h3 className="font-semibold text-destructive">
            Wrong Network Detected
          </h3>
          <p className="text-sm text-muted-foreground">
            You&apos;re connected to <span className="font-medium">{getChainName(chain.id)}</span>, 
            but this app requires <span className="font-medium">Arbitrum Sepolia</span>.
          </p>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleSwitchChain}
              disabled={isPending}
              className="text-xs"
            >
              {isPending ? 'Switching...' : 'Switch to Arbitrum Sepolia'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open('https://sepolia.arbiscan.io/', '_blank')}
              className="text-xs"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Add Network
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
