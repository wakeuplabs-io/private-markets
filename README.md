# Private Prediction Markets

Cross-chain private betting system using Aztec (private) + Arbitrum (public resolution) with Wormhole messaging.

## Quick Start

1. **Start local blockchain**
   ```bash
   anvil --port 9555
   ```

2. **Start Aztec sandbox**
   ```bash
   aztec start --sandbox
   ```

3. **Deploy Aztec contracts**
   ```bash
   npm run avm:deploy:token    # Deploy token contract
   npm run avm:deploy:vault    # (skip) Deploy vault contract 
   ```

4. **Deploy EVM contracts**
   ```bash
   npm run evm:deploy:market   # Deploy prediction market
   ```

5. **Copy contract addresses to frontend env**
   - Update `packages/frontend/.env.local` with the deployed addresses:
     - `NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS`
     - `NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS`
     - `NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS`

6. **Start frontend**
   ```bash
   npm run dev
   ```

## Structure

- `packages/avm/` - Aztec contracts (private betting)
- `packages/evm/` - Solidity contracts (public resolution)
- `packages/frontend/` - Next.js app
