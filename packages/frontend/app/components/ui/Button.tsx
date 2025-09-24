import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'success' | 'destructive' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'

    const variants = {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-md',
      success: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
    }

    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-12 px-6 text-base',
      lg: 'h-14 px-8 text-lg',
    }

    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
export type { ButtonProps }