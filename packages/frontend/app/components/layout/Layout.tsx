import React from 'react'
import { Header } from './Header'
import { BackgroundMesh } from './BackgroundMesh'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: React.ReactNode
  className?: string
}

const Layout: React.FC<LayoutProps> = ({
  children,
  className
}) => {
  return (
    <div className={cn('min-h-screen bg-background relative', className)}>
      <BackgroundMesh />

      <Header />

      <main className="relative z-0 flex-1">
        {children}
      </main>
    </div>
  )
}

export { Layout }
export type { LayoutProps }