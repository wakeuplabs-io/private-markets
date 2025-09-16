export type WalletConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type WalletType = 'aztec' | 'ethereum' | 'metamask'

export interface WalletInfo {
  address: string
  type: WalletType
  chainId?: number
  balance?: {
    eth?: string
    usdc?: string
  }
}

export interface WalletState {
  status: WalletConnectionStatus
  wallet: WalletInfo | null
  error: string | null
}

export interface ConnectWalletOptions {
  type: WalletType
  chainId?: number
}