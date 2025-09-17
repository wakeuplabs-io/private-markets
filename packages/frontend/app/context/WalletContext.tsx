'use client'

import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { createPXEClient, waitForPXE, type PXE } from "@aztec/aztec.js"
import { createAzguardClient, connectToAzguard, isAzguardAvailable } from "@/lib/azguard"
import type { AzguardClient } from "@azguardwallet/client"
import { WalletState, WalletInfo, WalletType } from '@/types'
import { tokenService } from "@/services/tokenService"
import { vaultService } from "@/services/vaultService"
import { CONTRACT_ADDRESSES } from "@/config/contracts"

interface WalletContextType extends WalletState {
  connectWallet: (type: WalletType) => Promise<void>
  disconnectWallet: () => void
  resetWallet: () => void
  isConnected: boolean
  isConnecting: boolean
  // Aztec-specific properties
  azguardClient?: AzguardClient
  pxe?: PXE
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

type WalletAction =
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS'; payload: WalletInfo }
  | { type: 'CONNECT_ERROR'; payload: string }
  | { type: 'DISCONNECT' }
  | { type: 'RESET' }
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
    case 'RESET':
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
    if (type !== 'aztec') {
      dispatch({ type: 'CONNECT_ERROR', payload: 'Only Aztec wallet (Azguard) is supported' })
      return
    }

    try {
      dispatch({ type: 'CONNECT_START' })

      if (!(await isAzguardAvailable())) {
        throw new Error(
          "Azguard Wallet no está instalado. Por favor instala Azguard Wallet y recarga la página."
        );
      }

      const client = await createAzguardClient();
      if (!client) {
        throw new Error("Could not create Azguard Wallet client.");
      }

      const connection = await connectToAzguard(client);
      if (!connection) {
        throw new Error("Connection failed.");
      }

      if (!connection.client.connected) {
        throw new Error("Azguard Wallet did not connect correctly.");
      }

      let pxe: PXE | undefined;
      try {
        const pxeUrl = process.env.NEXT_PUBLIC_PXE_URL ?? "http://localhost:8080";
        pxe = createPXEClient(pxeUrl);
        await waitForPXE(pxe);
      } catch (pxeError) {
        console.warn("PXE connection failed, continuing without direct PXE:", pxeError);
      }


      const walletInfo: WalletInfo = {
        address: connection.client.accounts[0] || '',
        type: 'aztec',
        chainId: 56,
        azguardClient: connection.client,
        pxe: pxe,
        accounts: connection.client.accounts
      }

      if (CONTRACT_ADDRESSES.TOKEN) {
        tokenService.setAzguardClient(connection.client, CONTRACT_ADDRESSES.TOKEN);
      }

      vaultService.setAzguardClient(connection.client);

      dispatch({ type: 'CONNECT_SUCCESS', payload: walletInfo })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet'
      dispatch({ type: 'CONNECT_ERROR', payload: errorMessage })
    }
  }

  const disconnectWallet = () => {
    tokenService.clearAzguardClient();
    vaultService.clearAzguardClient();
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
    isConnecting: state.status === 'connecting',
    azguardClient: state.wallet?.azguardClient,
    pxe: state.wallet?.pxe
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