'use client'

import React, { useState } from 'react'
import { Header } from './Header'
import { BackgroundMesh } from './BackgroundMesh'
import { AvatarModal } from './AvatarModal'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: React.ReactNode
  className?: string
}

const Layout: React.FC<LayoutProps> = ({
  children,
  className
}) => {
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false)

  return (
    <div className={cn('min-h-screen bg-background relative w-full overflow-x-hidden', className)}>
      <BackgroundMesh />

      <Header onAvatarClick={() => setIsAvatarModalOpen(true)} />

      <main className="relative z-0 flex-1 w-full xl:max-w-[1565px] mx-auto px-4 lg:px-6 xl:px-8">
        {children}
      </main>

      {/* Avatar Modal */}
      <AvatarModal 
        isOpen={isAvatarModalOpen} 
        onClose={() => setIsAvatarModalOpen(false)} 
      />
    </div>
  )
}

export { Layout }
export type { LayoutProps }