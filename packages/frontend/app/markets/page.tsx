"use client"
import dynamic from 'next/dynamic'

const MarketsPage = dynamic(() => import('@/components/market/MarketsPage').then(mod => ({ default: mod.MarketsPage })), {
  ssr: false
})

export default function Page() {
  return <MarketsPage />
}