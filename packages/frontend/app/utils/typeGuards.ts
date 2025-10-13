import React from 'react'
import { Market, AdminMarket, MarketOptionWithOdds, MarketOption } from '@/types'

/**
 * Type guards and validation utilities for bulletproof components
 *
 * These utilities ensure safe access to object properties and arrays,
 * preventing runtime errors from null/undefined access.
 */

// Basic type guards
export const isValidString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0
}

export const isValidNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value)
}

export const isValidDate = (value: unknown): value is Date => {
  return value instanceof Date && !isNaN(value.getTime())
}

export const isValidArray = <T>(value: unknown): value is T[] => {
  return Array.isArray(value)
}

export const isNonEmptyArray = <T>(value: unknown): value is T[] => {
  return Array.isArray(value) && value.length > 0
}

// Market-specific type guards
export const isValidMarketOption = (option: unknown): option is MarketOptionWithOdds => {
  if (!option || typeof option !== 'object') return false

  const opt = option as MarketOptionWithOdds
  return (
    isValidString(opt.id) &&
    isValidString(opt.name) &&
    isValidNumber(opt.odds) &&
    opt.odds > 0
  )
}

export const isValidMarketOptions = (options: unknown): options is MarketOptionWithOdds[] => {
  return isNonEmptyArray(options) && options.every(isValidMarketOption)
}

export const isValidMarket = (market: unknown): market is Market => {
  if (!market || typeof market !== 'object') return false

  const m = market as Market
  return (
    isValidString(m.id) &&
    isValidString(m.question) &&
    isValidMarketOptions(m.options) &&
    isValidString(m.status) &&
    isValidDate(m.createdAt) &&
    ['open', 'finalized', 'resolved'].includes(m.status)
  )
}

export const isValidAdminMarket = (market: unknown): market is AdminMarket => {
  if (!isValidMarket(market)) return false

  const adminMarket = market as AdminMarket
  return (
    adminMarket.adminActions &&
    typeof adminMarket.adminActions === 'object' &&
    typeof adminMarket.adminActions.canResolve === 'boolean' &&
    typeof adminMarket.adminActions.canEdit === 'boolean' &&
    typeof adminMarket.adminActions.canDelete === 'boolean' &&
    adminMarket.bets &&
    typeof adminMarket.bets === 'object' &&
    isValidNumber(adminMarket.bets.total) &&
    isValidNumber(adminMarket.bets.yesCount) &&
    isValidNumber(adminMarket.bets.noCount) &&
    isValidNumber(adminMarket.bets.totalVolume) &&
    adminMarket.performance &&
    typeof adminMarket.performance === 'object' &&
    isValidNumber(adminMarket.performance.views) &&
    isValidNumber(adminMarket.performance.engagement)
  )
}

// Safe property access helpers
export const safeGetProperty = <T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  fallback: T[K]
): T[K] => {
  if (!obj || typeof obj !== 'object') return fallback
  const value = obj[key]
  return value !== undefined && value !== null ? value : fallback
}

export const safeGetString = (
  obj: Record<string, unknown> | null | undefined,
  key: string,
  fallback: string = ''
): string => {
  if (!obj) return fallback
  const value = obj[key]
  return isValidString(value) ? value : fallback
}

export const safeGetNumber = (
  obj: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number = 0
): number => {
  if (!obj) return fallback
  const value = obj[key]
  return isValidNumber(value) ? value : fallback
}

export const safeGetDate = (
  obj: Record<string, unknown> | null | undefined,
  key: string,
  fallback?: Date
): Date | null => {
  if (!obj) return fallback || null
  const value = obj[key]
  return isValidDate(value) ? value : (fallback || null)
}

export const safeGetArray = <T>(
  obj: Record<string, unknown> | null | undefined,
  key: string,
  fallback: T[] = []
): T[] => {
  if (!obj) return fallback
  const value = obj[key]
  return isValidArray<T>(value) ? value : fallback
}

// Market-specific safe getters
export const safeGetMarketOptions = (market: Market | null | undefined): MarketOptionWithOdds[] => {
  if (!market) return []
  return isValidMarketOptions(market.options) ? market.options : []
}

export const safeGetMarketClosingDate = (market: Market | null | undefined): Date | null => {
  if (!market) return null
  return isValidDate(market.closingDate) ? market.closingDate : null
}

export const safeGetMarketWinningOption = (market: Market | null | undefined): MarketOptionWithOdds | null => {
  if (!market) return null
  return isValidMarketOption(market.winningOption) ? market.winningOption : null
}

// Format helpers with safe fallbacks
export const safeFormatDate = (
  date: Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback: string = 'TBD'
): string => {
  if (!isValidDate(date)) return fallback

  try {
    return new Intl.DateTimeFormat('en-US', options).format(date)
  } catch {
    return fallback
  }
}

export const safeFormatNumber = (
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
  fallback: string = '0'
): string => {
  if (!isValidNumber(value)) return fallback

  try {
    return new Intl.NumberFormat('en-US', options).format(value)
  } catch {
    return fallback
  }
}

// Market option helpers
export const findMarketOption = (
  options: MarketOptionWithOdds[] | null | undefined,
  optionId: string
): MarketOptionWithOdds | null => {
  if (!isValidArray(options)) return null
  return options.find(opt => opt.id === optionId) || null
}

export const getMarketOptionName = (
  options: MarketOptionWithOdds[] | null | undefined,
  optionId: string,
  fallback: string = 'Unknown'
): string => {
  const option = findMarketOption(options, optionId)
  return option ? option.name : fallback
}

// Validation helpers for forms
export const isValidMarketOptionChoice = (option: MarketOption | null | undefined): option is MarketOption => {
  return option === 'yes' || option === 'no'
}

export const isValidAmount = (amount: string | number | null | undefined): boolean => {
  if (typeof amount === 'string') {
    const numValue = parseFloat(amount)
    return !isNaN(numValue) && numValue > 0 && numValue <= 254
  }
  return isValidNumber(amount) && amount > 0 && amount <= 254
}

// Error boundary helpers
export const createSafeComponent = <T extends Record<string, unknown>>(
  requiredProps: (keyof T)[],
  component: React.ComponentType<T>
) => {
  const SafeComponent = (props: T) => {
    const hasAllRequiredProps = requiredProps.every(prop => {
      const value = props[prop]
      return value !== null && value !== undefined
    })

    if (!hasAllRequiredProps) {
      console.warn('Component received invalid props:', { props, requiredProps })
      return null
    }

    return React.createElement(component, props)
  }

  SafeComponent.displayName = `Safe(${component.displayName || component.name || 'Component'})`
  return SafeComponent
}