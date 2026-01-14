"use client"
import dynamic from 'next/dynamic'

const AdminPage = dynamic(() => import('@/components/admin/AdminPage').then(mod => ({ default: mod.AdminPage })), {
  ssr: false
})

export default function Page() {
  return <AdminPage />
}