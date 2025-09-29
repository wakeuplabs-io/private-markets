'use client'

import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { walletService, type WalletInfo } from "@/services/walletService"
import { tokenService } from "@/services/tokenService"
import { vaultService } from "@/services/vaultService"
import { CONTRACT_ADDRESSES } from "@/config/contracts"
import type { WalletConnector } from "@/lib/wallet"

interface WalletContextType {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  wallet: WalletInfo | null
  error: string | null
  connectWallet: (connector: WalletConnector) => Promise<void>
  disconnectWallet: () => void
  resetWallet: () => void
  isConnected: boolean
  isConnecting: boolean
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

type WalletAction =
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS'; payload: WalletInfo }
  | { type: 'CONNECT_ERROR'; payload: string }
  | { type: 'DISCONNECT' }
  | { type: 'RESET' }

type WalletState = {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  wallet: WalletInfo | null
  error: string | null
}

const initialState: WalletState = {
  status: 'disconnected',
  wallet: null,
  error: null
}

function walletReducer(state: WalletState, action: WalletAction): WalletState {
  switch (action.type) {
    case 'CONNECT_START':
      return {
        ...state,
        status: 'connecting',
        error: null
      }
    case 'CONNECT_SUCCESS':
      return {
        ...state,
        status: 'connected',
        wallet: action.payload,
        error: null
      }
    case 'CONNECT_ERROR':
      return {
        ...state,
        status: 'error',
        wallet: null,
        error: action.payload
      }
    case 'DISCONNECT':
      return {
        ...state,
        status: 'disconnected',
        wallet: null,
        error: null
      }
    case 'RESET':
      return {
        ...state,
        status: 'disconnected',
        wallet: null,
        error: null
      }
    default:
      return state
  }
}

interface WalletProviderProps {
  children: ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [state, dispatch] = useReducer(walletReducer, initialState)

  const connectWallet = async (connector: WalletConnector) => {
    try {
      dispatch({ type: 'CONNECT_START' })

      // Connect using wallet service
      const walletInfo = await walletService.connectWithPersistence(connector)

      if (CONTRACT_ADDRESSES.TOKEN) {
        tokenService.initialize(CONTRACT_ADDRESSES.TOKEN)
      }

      dispatch({ type: 'CONNECT_SUCCESS', payload: walletInfo })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet'
      dispatch({ type: 'CONNECT_ERROR', payload: errorMessage })
    }
  }

  const disconnectWallet = () => {
    walletService.disconnect()
    tokenService.clearCache()
    vaultService.clearCache()
    dispatch({ type: 'DISCONNECT' })
  }

  const resetWallet = () => {
    dispatch({ type: 'RESET' })
  }

  const contextValue: WalletContextType = {
    ...state,
    connectWallet,
    disconnectWallet,
    resetWallet,
    isConnected: state.status === 'connected',
    isConnecting: state.status === 'connecting'
  }

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}