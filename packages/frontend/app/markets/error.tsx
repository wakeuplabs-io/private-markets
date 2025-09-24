'use client'

import React from 'react'
import { Layout } from '@/components/layout'
import { Button } from '@/components/ui/Button'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function MarketsError({ error, reset }: ErrorPageProps) {
  return (
    <Layout>
      <div className="container mx-auto px-8 py-16">
        <div className="text-center space-y-6 max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Something went wrong
            </h1>
            <p className="text-muted-foreground">
              We encountered an error while loading the prediction markets.
            </p>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-left">
              <h3 className="font-medium text-destructive mb-2">Error Details:</h3>
              <pre className="text-xs text-destructive/80 overflow-auto">
                {error.message}
              </pre>
              {error.digest && (
                <p className="text-xs text-destructive/60 mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="default"
              onClick={reset}
            >
              Try Again
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.location.href = '/'}
            >
              Go Home
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  )
}