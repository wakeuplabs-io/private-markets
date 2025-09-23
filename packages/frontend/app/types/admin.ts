import { AdminMarket, MarketOptionWithOdds } from "./market"

// Admin-specific types for the creation flow
export type CreateMarketStep = 'form' | 'review' | 'success' | 'error'

export interface CreateMarketFlow {
  currentStep: CreateMarketStep
  formData: CreateMarketFormData | null
  createdMarket: AdminMarket | null
  error: string | null
}

export interface CreateMarketFormData {
  question: string
  optionYes: string
  optionNo: string
  closingDate: Date
  disclaimer?: string
}

export interface AdminUser {
  id: string
  name: string
  address: string
  role: 'admin' | 'super_admin'
  permissions: {
    createMarkets: boolean
    resolveMarkets: boolean
    viewAnalytics: boolean
  }
}

export interface AdminDashboardStats {
  totalMarkets: number
  activeMarkets: number
  totalVolume: number
  totalBets: number
  todayStats: {
    newMarkets: number
    newBets: number
    volume: number
  }
}

// Modal states
export interface ModalState<T = unknown> {
  isOpen: boolean
  data?: T
}

export interface AdminModalStates {
  createMarket: ModalState
  reviewMarket: ModalState
  successMarket: ModalState
  resolveMarket: ModalState
}

// API Response types
export interface CreateMarketResponse {
  success: boolean
  market?: AdminMarket
  error?: string
  txHash?: string
}

export interface ResolveMarketResponse {
  success: boolean
  marketId: string
  winningOption: MarketOptionWithOdds
  txHash?: string
  error?: string
}