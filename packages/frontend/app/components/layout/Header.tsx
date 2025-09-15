'use client'

import React from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface HeaderProps {
  className?: string
}

const Header: React.FC<HeaderProps> = ({
  className
}) => {
  return (
    <header
      className={cn(
        'relative z-10 w-full h-22 backdrop-blur-sm',
        'bg-card/70 border-b border-border',
        className
      )}
    >
      <div className="flex items-center justify-between h-full px-8 max-w-[1565px] mx-auto">
        {/* Left side - Logo */}
        <div className="flex items-center">
          <h1 className="text-xl text-foreground">
            PRIVATE <span className="font-bold">MARKETS</span>
          </h1>
        </div>

        {/* Right side - Connected State */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-sm text-foreground">Connected</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="text-xs"
          >
            My Activity
          </Button>
        </div>
      </div>
    </header>
  )
}

export { Header }
export type { HeaderProps }