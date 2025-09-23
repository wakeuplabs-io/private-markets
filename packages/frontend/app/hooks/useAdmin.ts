'use client'

import { useMemo } from 'react'

interface UseAdminReturn {
  isAdmin: boolean
  isLoading: boolean
}

export function useAdmin(userAddress?: string): UseAdminReturn {
  const isAdmin = useMemo(() => {
    if (!userAddress) return false

    const adminAddresses = process.env.NEXT_PUBLIC_ADMIN_ADDRESSES?.split(',').map(addr => addr.trim().toLowerCase()) || []

    return adminAddresses.includes(userAddress.toLowerCase())
  }, [userAddress])

  return {
    isAdmin,
    isLoading: false
  }
}