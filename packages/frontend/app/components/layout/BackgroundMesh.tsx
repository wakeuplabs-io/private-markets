import React from 'react'
import { cn } from '@/lib/utils'

interface BackgroundMeshProps {
  className?: string
}

const BackgroundMesh: React.FC<BackgroundMeshProps> = ({ className }) => {
  return (
    <div
      className={cn(
        'absolute inset-0 opacity-[0.5] pointer-events-none',
        className
      )}
    >
      <div
        className="w-full h-full bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/mesh.svg)'
        }}
      />
    </div>
  )
}

export { BackgroundMesh }