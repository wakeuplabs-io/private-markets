'use client'

import React from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { cn } from '@/lib/utils'

// Loading states
interface LoadingStateProps {
  message?: string
  className?: string
  variant?: 'default' | 'minimal' | 'card'
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  className,
  variant = 'default'
}) => {
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">{message}</span>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <Card className={cn('p-8 text-center', className)}>
        <div className="w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-muted-foreground">{message}</div>
      </Card>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg overflow-hidden">
        <div className="p-8 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <div className="text-muted-foreground">{message}</div>
        </div>
      </div>
    </div>
  )
}

// Error states
interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
  variant?: 'default' | 'minimal' | 'card'
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'There was an error loading this content.',
  onRetry,
  className,
  variant = 'default'
}) => {
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-2 text-destructive', className)}>
        <span className="text-lg">⚠️</span>
        <span className="text-sm">{message}</span>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <Card className={cn('p-8 text-center', className)}>
        <div className="w-12 h-12 mx-auto bg-destructive/20 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h3 className="font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="secondary" size="sm">
            Try Again
          </Button>
        )}
      </Card>
    )
  }

  return (
    <div className={cn('text-center py-12', className)}>
      <div className="w-16 h-16 mx-auto bg-destructive/20 rounded-full flex items-center justify-center mb-4">
        <span className="text-2xl">⚠️</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary">
          Try Again
        </Button>
      )}
    </div>
  )
}

// Empty states
interface EmptyStateProps {
  title?: string
  message?: string
  actionLabel?: string
  onAction?: () => void
  icon?: string
  className?: string
  variant?: 'default' | 'card'
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Nothing here yet',
  message = 'There are no items to display.',
  actionLabel,
  onAction,
  icon = '📊',
  className,
  variant = 'default'
}) => {
  if (variant === 'card') {
    return (
      <Card className={cn('p-8 text-center', className)}>
        <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">{icon}</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        {actionLabel && onAction && (
          <Button onClick={onAction}>{actionLabel}</Button>
        )}
      </Card>
    )
  }

  return (
    <div className={cn('text-center py-12', className)}>
      <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
        <span className="text-2xl">{icon}</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  )
}

// Data validation error component
interface InvalidDataStateProps {
  dataType?: string
  onRefresh?: () => void
  className?: string
}

export const InvalidDataState: React.FC<InvalidDataStateProps> = ({
  dataType = 'data',
  onRefresh,
  className
}) => {
  return (
    <div className={cn('text-center py-8 px-4', className)}>
      <div className="w-12 h-12 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center mb-4">
        <span className="text-2xl">⚠️</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Invalid Data</h3>
      <p className="text-sm text-muted-foreground mb-4">
        The {dataType} received is incomplete or invalid. This might be a temporary issue.
      </p>
      {onRefresh && (
        <Button onClick={onRefresh} variant="secondary" size="sm">
          Refresh
        </Button>
      )}
    </div>
  )
}

// Skeleton loaders for different components
export const MarketCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('bg-card/65 backdrop-blur-sm rounded border border-border p-4 space-y-4', className)}>
    <div className="flex items-start gap-3">
      <div className="w-12 h-12 bg-muted rounded animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded animate-pulse" />
        <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
      </div>
    </div>
    <div className="flex gap-2">
      <div className="h-6 bg-muted rounded flex-1 animate-pulse" />
      <div className="h-6 bg-muted rounded flex-1 animate-pulse" />
    </div>
    <div className="flex gap-3">
      <div className="h-12 bg-muted rounded flex-1 animate-pulse" />
      <div className="h-12 bg-muted rounded flex-1 animate-pulse" />
    </div>
  </div>
)

export const AdminMarketCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <Card className={cn('h-full bg-card/50 backdrop-blur-sm border border-border', className)}>
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-3 bg-muted rounded w-20 animate-pulse" />
        </div>
        <div className="w-12 h-12 bg-muted rounded-lg animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-muted rounded animate-pulse" />
        <div className="h-3 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-4 py-3 border-t border-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 bg-muted rounded w-12 animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-muted rounded animate-pulse" />
        <div className="h-3 bg-muted rounded animate-pulse" />
      </div>
      <div className="pt-4 border-t border-border">
        <div className="flex gap-2">
          <div className="h-8 bg-muted rounded flex-1 animate-pulse" />
          <div className="h-8 bg-muted rounded flex-1 animate-pulse" />
        </div>
      </div>
    </div>
  </Card>
)

// HOC for safe component rendering
interface SafeRenderProps<T> {
  data: T | null | undefined
  fallback?: React.ReactNode
  skeleton?: React.ReactNode
  children: (data: T) => React.ReactNode
  validator?: (data: unknown) => data is T
  className?: string
}

export function SafeRender<T>({
  data,
  fallback,
  skeleton,
  children,
  validator,
  className
}: SafeRenderProps<T>) {
  // Show skeleton while loading
  if (data === undefined && skeleton) {
    return <div className={className}>{skeleton}</div>
  }

  // Show fallback for null/invalid data
  if (data === null || data === undefined) {
    return (
      <div className={className}>
        {fallback || <InvalidDataState />}
      </div>
    )
  }

  // Validate data if validator is provided
  if (validator && !validator(data)) {
    return (
      <div className={className}>
        {fallback || <InvalidDataState />}
      </div>
    )
  }

  try {
    return <div className={className}>{children(data)}</div>
  } catch (error) {
    console.error('Error rendering component:', error)
    return (
      <div className={className}>
        <ErrorState
          title="Render Error"
          message="There was an error displaying this content."
        />
      </div>
    )
  }
}

// Utility function to create safe components
export function withSafeRender<T extends Record<string, unknown>>(
  Component: React.ComponentType<T>,
  validator?: (props: unknown) => props is T
) {
  return function SafeComponent(props: T) {
    if (validator && !validator(props)) {
      return <InvalidDataState dataType="component props" />
    }

    try {
      return <Component {...props} />
    } catch (error) {
      console.error('Error in safe component:', error)
      return (
        <ErrorState
          title="Component Error"
          message="There was an error rendering this component."
        />
      )
    }
  }
}