import React from 'react'
import { Layout } from '@/components/layout'

export default function MarketsLoading() {
  return (
    <Layout>
      <div className="container mx-auto px-8 py-8">
        {/* Header skeleton */}
        <div className="mb-8 space-y-2">
          <div className="h-8 bg-muted rounded-lg w-64 animate-pulse" />
          <div className="h-4 bg-muted rounded-lg w-96 animate-pulse" />
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-6 space-y-4"
            >
              {/* Card header */}
              <div className="space-y-2">
                <div className="h-5 bg-muted rounded w-full animate-pulse" />
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-2">
                <div className="h-12 bg-muted rounded-lg animate-pulse" />
                <div className="h-12 bg-muted rounded-lg animate-pulse" />
              </div>

              {/* Footer */}
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                <div className="h-10 bg-muted rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}