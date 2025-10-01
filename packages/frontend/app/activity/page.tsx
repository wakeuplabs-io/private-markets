"use client"
import dynamic from 'next/dynamic'

const ActivityPage = dynamic(() => import('@/components/activity').then(mod => ({ default: mod.ActivityPage })), {
  ssr: false
})

export default function Activity() {
  return <ActivityPage />
}
