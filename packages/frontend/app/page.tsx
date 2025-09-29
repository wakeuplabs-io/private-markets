'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function Home() {
  return (
    <>
      <div className="relative min-h-screen">
        <div className="container mx-auto px-8 py-24">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-6xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
              PRIVATE{' '}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                MARKETS
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              Private betting with zero-knowledge proofs on cross-chain markets.
              Trade predictions while preserving your privacy.
            </p>

            <div className="grid md:grid-cols-3 gap-8 mb-12 max-w-4xl mx-auto">
              <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6">
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-2xl">🔒</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Zero-Knowledge Privacy</h3>
                <p className="text-sm text-muted-foreground">
                  Your trades and positions remain completely private using advanced ZK proofs
                </p>
              </div>

              <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6">
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-2xl">⚡</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Cross-Chain Trading</h3>
                <p className="text-sm text-muted-foreground">
                  Seamless trading across Aztec and Arbitrum with Wormhole integration
                </p>
              </div>

              <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6">
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <span className="text-2xl">🎯</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Prediction Markets</h3>
                <p className="text-sm text-muted-foreground">
                  Trade on real-world events, crypto prices, and future outcomes
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/markets">
                <Button
                  variant="default"
                  size="lg"
                  className="font-semibold px-8 py-4 text-lg"
                >
                  Explore Markets
                </Button>
              </Link>

              <Button
                variant="secondary"
                size="lg"
                className="font-semibold px-8 py-4 text-lg"
                onClick={() => window.open('https://docs.aztec.network', '_blank')}
              >
                Learn More
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary mb-1">100%</div>
                <div className="text-sm text-muted-foreground">Private</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary mb-1">⚡</div>
                <div className="text-sm text-muted-foreground">Fast Trades</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary mb-1">🔗</div>
                <div className="text-sm text-muted-foreground">Cross-Chain</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary mb-1">🛡️</div>
                <div className="text-sm text-muted-foreground">Secure</div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>
      </div>
    </>
  )
}