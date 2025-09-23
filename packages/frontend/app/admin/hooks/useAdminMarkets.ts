'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdminMarket, AdminMarketFilters, CreateMarketFormData, MarketResolutionData } from '@/types'
import { AdminMarketService } from '../services/adminMarketService'

interface UseAdminMarketsReturn {
  markets: AdminMarket[]
  filteredMarkets: AdminMarket[]
  isLoading: boolean
  error: string | null
  filters: AdminMarketFilters
  setFilters: (filters: AdminMarketFilters) => void
  createMarket: (formData: CreateMarketFormData) => Promise<AdminMarket>
  resolveMarket: (resolutionData: MarketResolutionData) => Promise<void>
  refreshMarkets: () => Promise<void>
  
  stats: {
    totalMarkets: number
    activeMarkets: number
    draftMarkets: number
    resolvedMarkets: number
    totalVolume: number
    totalBets: number
  }
}

export function useAdminMarkets(): UseAdminMarketsReturn {
  const [markets, setMarkets] = useState<AdminMarket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<AdminMarketFilters>({
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })

  useEffect(() => {
    const loadMarkets = async () => {
      setIsLoading(true)
      try {
        const markets = await AdminMarketService.getMarkets(filters)
        setMarkets(markets)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar los mercados')
      } finally {
        setIsLoading(false)
      }
    }

    loadMarkets()
  }, [filters])

  // Aplicar filtros y ordenamiento
  const filteredMarkets = useCallback(() => {
    let result = [...markets]

    // Filtrar por status
    if (filters.status && filters.status.length > 0) {
      result = result.filter(market => filters.status!.includes(market.status))
    }

    // Filtrar por rango de fechas
    if (filters.dateRange) {
      const { from, to } = filters.dateRange
      result = result.filter(market => {
        const marketDate = new Date(market.createdAt)
        return marketDate >= from && marketDate <= to
      })
    }

    // Ordenar
    if (filters.sortBy) {
      result.sort((a, b) => {
        let aValue, bValue

        switch (filters.sortBy) {
          case 'createdAt':
            aValue = new Date(a.createdAt).getTime()
            bValue = new Date(b.createdAt).getTime()
            break
          case 'closingDate':
            aValue = new Date(a.closingDate).getTime()
            bValue = new Date(b.closingDate).getTime()
            break
          case 'volume':
            aValue = a.bets.totalVolume
            bValue = b.bets.totalVolume
            break
          case 'engagement':
            aValue = a.performance.engagement
            bValue = b.performance.engagement
            break
          default:
            return 0
        }

        if (filters.sortOrder === 'desc') {
          return bValue - aValue
        }
        return aValue - bValue
      })
    }

    return result
  }, [markets, filters])()

  // Calcular estadísticas
  const stats = useCallback(() => {
    const totalMarkets = markets.length
    const activeMarkets = markets.filter(m => m.status === 'active').length
    const draftMarkets = markets.filter(m => m.status === 'draft').length
    const resolvedMarkets = markets.filter(m => m.status === 'resolved').length
    const totalVolume = markets.reduce((sum, m) => sum + m.bets.totalVolume, 0)
    const totalBets = markets.reduce((sum, m) => sum + m.bets.total, 0)

    return {
      totalMarkets,
      activeMarkets,
      draftMarkets,
      resolvedMarkets,
      totalVolume,
      totalBets
    }
  }, [markets])()

  // Crear nuevo mercado
  const createMarket = useCallback(async (formData: CreateMarketFormData): Promise<AdminMarket> => {
    setIsLoading(true)
    try {
      const response = await AdminMarketService.createMarket(formData)
      if (!response.market) {
        throw new Error('Failed to create market: No market returned')
      }
      const newMarket = response.market

      setMarkets(prev => [newMarket, ...prev])
      setError(null)
      return newMarket
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear el mercado'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Resolver mercado
  const resolveMarket = useCallback(async (resolutionData: MarketResolutionData): Promise<void> => {
    setIsLoading(true)
    try {
      const response = await AdminMarketService.resolveMarket(resolutionData)

      setMarkets(prev => prev.map(market => {
        if (market.id === resolutionData.marketId) {
          return {
            ...market,
            status: 'resolved' as const,
            resolvedAt: new Date(),
            winningOption: response.winningOption,
            adminActions: {
              ...market.adminActions,
              canResolve: false,
              canEdit: false
            }
          }
        }
        return market
      }))
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al resolver el mercado'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshMarkets = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      const markets = await AdminMarketService.getMarkets(filters)
      setMarkets(markets)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error refreshing markets"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  return {
    markets,
    filteredMarkets,
    isLoading,
    error,
    filters,
    setFilters,
    createMarket,
    resolveMarket,
    refreshMarkets,
    stats
  }
}
