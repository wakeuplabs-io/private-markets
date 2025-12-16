import { createConfig, http, fallback } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { arbitrumSepolia, localhost } from 'viem/chains'

const localChain = {
  ...localhost,
  id: 31337,
  name: 'Anvil',
  rpcUrls: {
    default: { http: ['http://127.0.0.1:9555'] },
    public: { http: ['http://127.0.0.1:9555'] }
  }
}

const arbitrumSepoliaRpcs = [
  'https://sepolia-rollup.arbitrum.io/rpc',
]

const createArbitrumTransport = () => {
  const transports = arbitrumSepoliaRpcs.map(rpc =>
    http(rpc, {
      timeout: 10000,
      retryCount: 2,
      retryDelay: 1000
    })
  )
  return fallback(transports)
}

const createLocalTransport = () => {
  const transports = [
    http('http://127.0.0.1:9555', {
      timeout: 5000,
      retryCount: 1,
      retryDelay: 1000
    }),
    http('http://localhost:9555', {
      timeout: 5000,
      retryCount: 1,
      retryDelay: 1000
    })
  ]
  return fallback(transports)
}

export const config = createConfig({
  chains: [localChain, arbitrumSepolia],
  connectors: [
    injected(),
  ],
  transports: {
    [localChain.id]: createLocalTransport(),
    [arbitrumSepolia.id]: createArbitrumTransport(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}