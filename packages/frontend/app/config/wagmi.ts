import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { localhost } from 'viem/chains'
const localChain = {
  ...localhost,
  id: 31337,
  name: 'Local Anvil',
  rpcUrls: {
    default: { http: ['http://127.0.0.1:9555'] },
    public: { http: ['http://127.0.0.1:9555'] }
  }
}

export const config = createConfig({
  chains: [localChain],
  connectors: [
    injected(),
  ],
  transports: {
    [localChain.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}