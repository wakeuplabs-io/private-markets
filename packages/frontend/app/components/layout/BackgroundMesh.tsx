import React from 'react'
import { cn } from '@/lib/utils'

interface BackgroundMeshProps {
  className?: string
}

const BackgroundMesh: React.FC<BackgroundMeshProps> = ({ className }) => {
  return (
    <div
      className={cn(
        'absolute inset-0 opacity-[0.07] pointer-events-none',
        className
      )}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1565 1715"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-cover"
      >
        <defs>
          <pattern
            id="mesh-pattern"
            x="0"
            y="0"
            width="120"
            height="120"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 0L120 120M120 0L0 120"
              stroke="hsl(var(--primary))"
              strokeWidth="0.5"
              opacity="0.3"
            />
            <circle
              cx="60"
              cy="60"
              r="2"
              fill="hsl(var(--primary))"
              opacity="0.2"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mesh-pattern)" />
      </svg>
    </div>
  )
}

export { BackgroundMesh }