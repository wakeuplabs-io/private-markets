'use client'

import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { WalletState, WalletInfo, WalletType } from '@/types'

interface WalletContextType extends WalletState {
  connectWallet: (type: WalletType) => Promise<void>
  disconnectWallet: () => void
  isConnected: boolean
  isConnecting: boolean
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

type WalletAction =
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS'; payload: WalletInfo }
  | { type: 'CONNECT_ERROR'; payload: string }
  | { type: 'DISCONNECT' }
  | { type: 'UPDATE_BALANCE'; payload: { eth?: string; usdc?: string } }

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
    case 'UPDATE_BALANCE':
      return {
        ...state,
        wallet: state.wallet
          ? {
              ...state.wallet,
              balance: {
                ...state.wallet.balance,
                ...action.payload
              }
            }
          : null
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

  const connectWallet = async (type: WalletType) => {
    dispatch({ type: 'CONNECT_START' })

    try {
      // Simulate wallet connection logic
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Mock wallet info - replace with actual wallet connection logic
      const walletInfo: WalletInfo = {
        address: '0x1234567890123456789012345678901234567890',
        type,
        chainId: type === 'aztec' ? 56 : 421614, // Aztec or Arbitrum Sepolia
        balance: {
          eth: '1.5',
          usdc: '100.0'
        }
      }

      dispatch({ type: 'CONNECT_SUCCESS', payload: walletInfo })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet'
      dispatch({ type: 'CONNECT_ERROR', payload: errorMessage })
    }
  }

  const disconnectWallet = () => {
    dispatch({ type: 'DISCONNECT' })
  }

  const contextValue: WalletContextType = {
    ...state,
    connectWallet,
    disconnectWallet,
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