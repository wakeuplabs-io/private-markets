import { createConfig, http, fallback } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { localhost } from 'viem/chains'

// Primary local chain configuration
const localChain = {
  ...localhost,
  id: 31337,
  name: 'Local Anvil',
  rpcUrls: {
    default: { http: ['http://127.0.0.1:9555'] },
    public: { http: ['http://127.0.0.1:9555'] }
  }
}

// Alternative RPC endpoints for fallback
const alternativeRpcs = [
  'http://127.0.0.1:8545',  // Alternative local node
  'http://localhost:9555',   // Localhost variant
  'http://localhost:8545',   // Alternative localhost
]

// Create transport with fallback support
const createTransportWithFallback = () => {
  const transports = [
    http('http://127.0.0.1:9555', {
      timeout: 5000,  // 5 second timeout
      retryCount: 1,
      retryDelay: 1000
    }),
    ...alternativeRpcs.map(rpc =>
      http(rpc, {
        timeout: 5000,
        retryCount: 1,
        retryDelay: 1000
      })
    )
  ]

  return fallback(transports)
}

export const config = createConfig({
  chains: [localChain],
  connectors: [
    injected(),
  ],
  transports: {
    [localChain.id]: createTransportWithFallback(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}