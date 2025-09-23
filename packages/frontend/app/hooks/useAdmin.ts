'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdminUser } from '@/types'

interface UseAdminReturn {
  isAdmin: boolean
  adminUser: AdminUser | null
  isLoading: boolean
  checkAdminStatus: () => Promise<void>
}

const mockAdminCheck = async (userAddress?: string): Promise<AdminUser | null> => {
  await new Promise(resolve => setTimeout(resolve, 500))

  const adminAddresses = [
    '0x279acb41a60fcce801cec69b3c7b23691e34cd3adb0149af2373acc8e08b97d2',
    '0x1234567890123456789012345678901234567890',
    'admin',
    'test'
  ]

  if (userAddress && adminAddresses.includes(userAddress.toLowerCase())) {
    return {
      id: 'admin_1',
      name: 'Admin User',
      address: userAddress,
      role: 'admin',
      permissions: {
        createMarkets: true,
        resolveMarkets: true,
        viewAnalytics: true
      }
    }
  }

  return null
}

export function useAdmin(userAddress?: string): UseAdminReturn {
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkAdminStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      const admin = await mockAdminCheck(userAddress)

      if (admin) {
        setIsAdmin(true)
        setAdminUser(admin)
      } else {
        setIsAdmin(false)
        setAdminUser(null)
      }
    } catch (error) {
      console.error('Failed to check admin status:', error)
      setIsAdmin(false)
      setAdminUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [userAddress])

  useEffect(() => {
    if (userAddress) {
      checkAdminStatus()
    } else {
      setIsAdmin(false)
      setAdminUser(null)
      setIsLoading(false)
    }
  }, [userAddress, checkAdminStatus])

  return {
    isAdmin,
    adminUser,
    isLoading,
    checkAdminStatus
  }
}