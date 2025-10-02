'use client'

import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react'
import { walletService, type WalletInfo } from "@/services/walletService"
import type { AccountStatus } from "@/types/wallet"
import { tokenService } from "@/services/token"
import { vaultService } from "@/services/vault"
import { CONTRACT_ADDRESSES } from "@/config/contracts"
import type { WalletConnector } from "@/lib/wallet"

interface WalletContextType {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  accountStatus: AccountStatus
  wallet: WalletInfo | null
  error: string | null
  connectWallet: (connector: WalletConnector) => Promise<void>
  createAccount: (connector: WalletConnector) => Promise<void>
  checkAccountStatus: (connector: WalletConnector) => Promise<void>
  disconnectWallet: () => void
  clearAccount: () => void
  resetWallet: () => void
  isConnected: boolean
  isConnecting: boolean
  isCheckingAccount: boolean
  isCreatingAccount: boolean
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

type WalletAction =
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS'; payload: WalletInfo }
  | { type: 'CONNECT_ERROR'; payload: string }
  | { type: 'CREATE_ACCOUNT_START' }
  | { type: 'CREATE_ACCOUNT_SUCCESS'; payload: WalletInfo }
  | { type: 'CREATE_ACCOUNT_ERROR'; payload: string }
  | { type: 'CHECK_ACCOUNT_START' }
  | { type: 'CHECK_ACCOUNT_SUCCESS'; payload: AccountStatus }
  | { type: 'CHECK_ACCOUNT_ERROR'; payload: string }
  | { type: 'DISCONNECT' }
  | { type: 'RESET' }

type WalletState = {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  accountStatus: AccountStatus
  wallet: WalletInfo | null
  error: string | null
}

const initialState: WalletState = {
  status: 'disconnected',
  accountStatus: 'checking',
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
        accountStatus: 'connected',
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
    case 'CREATE_ACCOUNT_START':
      return {
        ...state,
        status: 'connecting',
        accountStatus: 'checking',
        error: null
      }
    case 'CREATE_ACCOUNT_SUCCESS':
      return {
        ...state,
        status: 'connected',
        accountStatus: 'connected',
        wallet: action.payload,
        error: null
      }
    case 'CREATE_ACCOUNT_ERROR':
      return {
        ...state,
        status: 'error',
        accountStatus: 'none',
        error: action.payload
      }
    case 'CHECK_ACCOUNT_START':
      return {
        ...state,
        accountStatus: 'checking',
        error: null
      }
    case 'CHECK_ACCOUNT_SUCCESS':
      return {
        ...state,
        accountStatus: action.payload,
        error: null
      }
    case 'CHECK_ACCOUNT_ERROR':
      return {
        ...state,
        accountStatus: 'none',
        error: action.payload
      }
    case 'DISCONNECT':
      return {
        ...state,
        status: 'disconnected',
        accountStatus: 'checking',
        wallet: null,
        error: null
      }
    case 'RESET':
      return {
        ...state,
        status: 'disconnected',
        accountStatus: 'checking',
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

  const checkAccountStatus = async (connector: WalletConnector) => {
    try {
      dispatch({ type: 'CHECK_ACCOUNT_START' })

      const accountStatus = await walletService.getAccountStatus(connector)
      dispatch({ type: 'CHECK_ACCOUNT_SUCCESS', payload: accountStatus })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check account status'
      dispatch({ type: 'CHECK_ACCOUNT_ERROR', payload: errorMessage })
    }
  }

  // Auto-detect account status on component mount
  useEffect(() => {
    const checkInitialAccountStatus = async () => {
      try {
        // Use 'aztec' as the default connector for auto-detection
        await checkAccountStatus('aztec')
      } catch (error) {
        console.warn('Failed to check initial account status:', error)
        // Set to 'none' if check fails to prevent infinite loading
        dispatch({ type: 'CHECK_ACCOUNT_SUCCESS', payload: 'none' })
      }
    }

    checkInitialAccountStatus()
  }, [])

  const connectWallet = async (connector: WalletConnector) => {
    try {
      dispatch({ type: 'CONNECT_START' })

      // Connect using wallet service
      const walletInfo = await walletService.connectWithPersistence(connector)
      console.log('[WalletContext] connectWallet - walletInfo:', walletInfo)

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

  const clearAccount = () => {
    walletService.clearAccount()
    tokenService.clearCache()
    vaultService.clearCache()
    dispatch({ type: 'RESET' })
  }

  const createAccount = async (connector: WalletConnector) => {
    try {
      dispatch({ type: 'CREATE_ACCOUNT_START' })

      // Create account using wallet service
      const walletInfo = await walletService.createAccount(connector)
      console.log('[WalletContext] createAccount - walletInfo:', walletInfo)

      if (CONTRACT_ADDRESSES.TOKEN) {
        tokenService.initialize(CONTRACT_ADDRESSES.TOKEN)
      }

      dispatch({ type: 'CREATE_ACCOUNT_SUCCESS', payload: walletInfo })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account'
      dispatch({ type: 'CREATE_ACCOUNT_ERROR', payload: errorMessage })
    }
  }

  const resetWallet = () => {
    dispatch({ type: 'RESET' })
  }

  const contextValue: WalletContextType = {
    ...state,
    connectWallet,
    createAccount,
    checkAccountStatus,
    disconnectWallet,
    clearAccount,
    resetWallet,
    isConnected: state.status === 'connected',
    isConnecting: state.status === 'connecting',
    isCheckingAccount: state.accountStatus === 'checking',
    isCreatingAccount: state.status === 'connecting' && state.accountStatus === 'checking'
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