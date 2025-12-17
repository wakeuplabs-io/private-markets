'use client'

import React from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { cn } from '@/lib/utils'

const ARBITRUM_SEPOLIA_CHAIN_ID = 421614

interface EvmConnectButtonProps {
  className?: string
}

export function EvmConnectButton({ className }: EvmConnectButtonProps) {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  const handleConnect = async () => {
    // Try to connect with the first available connector (usually MetaMask/injected)
    const connector = connectors.find(c => c.type === 'injected') || connectors[0]
    if (connector) {
      connect({ connector, chainId: ARBITRUM_SEPOLIA_CHAIN_ID })
    }
  }

  const handleSwitchToArbitrum = () => {
    switchChain({ chainId: ARBITRUM_SEPOLIA_CHAIN_ID })
  }

  const isWrongNetwork = isConnected && chain?.id !== ARBITRUM_SEPOLIA_CHAIN_ID

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const getChainDisplay = () => {
    if (!chain) return ''

    switch (chain.id) {
      case 421614:
        return 'Arbitrum Sepolia'
      case 31337:
        return 'Local'
      default:
        return chain.name
    }
  }

  if (isConnected && address) {
    // Show switch network button if on wrong network
    if (isWrongNetwork) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span className="text-xs text-yellow-400 font-medium">
                Wrong Network
              </span>
            </div>
            <button
              onClick={() => disconnect()}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Disconnect EVM wallet"
            >
              Disconnect
            </button>
          </div>
          <button
            onClick={handleSwitchToArbitrum}
            className="w-full px-3 py-1.5 text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-md transition-colors"
            title="Switch to Arbitrum Sepolia"
          >
            Switch to Arbitrum Sepolia
          </button>
        </div>
      )
    }

    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
          <span className="text-xs text-green-400 font-medium truncate">
            {formatAddress(address)}
          </span>
          {chain && (
            <span className="text-xs text-muted-foreground truncate">
              {getChainDisplay()}
            </span>
          )}
        </div>
        <button
          onClick={() => disconnect()}
          className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title="Disconnect EVM wallet"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isPending}
      className={cn(
        'px-4 py-2 text-sm font-medium text-white',
        'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50',
        'border border-blue-500/30 rounded-md',
        'transition-colors duration-200',
        'disabled:cursor-not-allowed',
        className
      )}
      title="Connect EVM wallet (MetaMask, etc.)"
    >
      {isPending ? 'Connecting...' : 'Connect EVM Wallet'}
    </button>
  )
}