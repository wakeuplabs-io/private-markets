"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { AlertTriangle } from "lucide-react"
import type { EVMTokenInfo } from "@/services/token/evmTokenService"

/**
 * EVM Token Balance Display Props
 */
export interface EVMTokenBalanceProps {
  tokenInfo?: EVMTokenInfo
  balance?: bigint
  loading?: boolean
  error?: string
  className?: string
}

/**
 * EVMTokenBalance Component
 *
 * Displays ERC20 token balance for EVM chains (Arbitrum).
 * Supports any ERC20 token with dynamic decimals in the Avatar Modal.
 */
export function EVMTokenBalance({
  tokenInfo,
  balance,
  loading,
  error,
  className
}: EVMTokenBalanceProps) {
  const formatBalance = (balance: bigint, decimals: number): string => {
    const divisor = BigInt(10 ** decimals)
    const integerPart = balance / divisor
    const fractionalPart = balance % divisor

    if (fractionalPart === BigInt(0)) {
      return integerPart.toString()
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
    const limitedFractional = fractionalStr.slice(0, 2)
    const trimmedFractional = limitedFractional.replace(/0+$/, '')

    if (trimmedFractional === '') {
      return integerPart.toString()
    }

    return `${integerPart}.${trimmedFractional}`
  }

  // Loading state
  if (loading) {
    return (
      <div className={cn(
        "flex items-center gap-4 animate-pulse",
        className
      )}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-muted" />
          <div className="flex flex-col gap-1">
            <div className="h-3 w-12 bg-muted rounded"></div>
            <div className="h-2 w-16 bg-muted rounded"></div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="h-2 w-10 bg-muted rounded"></div>
          <div className="h-3 w-8 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-destructive text-xs",
        className
      )}>
        <div className="w-2 h-2 rounded-full bg-destructive" />
        <span>Failed to load balance</span>
      </div>
    )
  }

  if (!tokenInfo) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-muted-foreground text-xs",
        className
      )}>
        <div className="w-2 h-2 rounded-full bg-gray-400" />
        <span>Not connected</span>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex items-center gap-4",
      className
    )}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground leading-none">
            {tokenInfo.symbol}
          </span>
          <span className="text-xs text-muted-foreground leading-none mt-0.5">
            {tokenInfo.name}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end">
        <span className="text-xs text-muted-foreground leading-none">
          Balance
        </span>
        <span className="text-sm font-medium text-foreground leading-none mt-0.5">
          {balance !== undefined
            ? formatBalance(balance, tokenInfo.decimals)
            : "--"
          }
        </span>
      </div>
    </div>
  )
}

export function EVMTokenBalanceCompact({
  tokenInfo,
  balance,
  loading,
  error,
  className
}: EVMTokenBalanceProps) {
  const formatBalance = (balance: bigint, decimals: number): string => {
    const divisor = BigInt(10 ** decimals)
    const integerPart = balance / divisor
    const fractionalPart = balance % divisor

    if (fractionalPart === BigInt(0)) {
      return integerPart.toString()
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
    const limitedFractional = fractionalStr.slice(0, 2)
    const trimmedFractional = limitedFractional.replace(/0+$/, '')

    if (trimmedFractional === '') {
      return integerPart.toString()
    }

    return `${integerPart}.${trimmedFractional}`
  }

  if (loading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-3 w-12 bg-muted rounded"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("text-destructive text-xs", className)}>
        <AlertTriangle className="h-3 w-3" />
      </div>
    )
  }

  if (!tokenInfo || balance === undefined) {
    return null
  }

  return (
    <div className={cn("flex items-center gap-1 text-sm", className)}>
      <span className="font-medium text-foreground">
        {formatBalance(balance, tokenInfo.decimals)}
      </span>
      <span className="text-muted-foreground">{tokenInfo.symbol}</span>
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
    </div>
  )
}
