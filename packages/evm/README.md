# Private Prediction Market - EVM Contracts

This package contains Solidity contracts for the **Private Prediction Market** system running on Arbitrum Sepolia. The system enables private betting on Aztec with public resolution and payouts on Arbitrum via Wormhole cross-chain messaging.

## 🏗️ Architecture Overview

```
Aztec (Private Betting)
    ↓ [Bet VAA via Wormhole]
Arbitrum Sepolia (Public Resolution)
    ↓ [WormholeReceiver → PredictionMarketCore]
Treasury (Token Management)
    ↓ [Mint on bet, Transfer on claim]
Winners (Verified Merkle Claims)
```

### Flow Summary
1. **Aztec**: Users place private bets using AIP-20 tokens
2. **Wormhole**: Bet data transmitted via VAA (Verified Action Approval)
3. **Arbitrum**: Bets aggregated, markets resolved publicly
4. **Claims**: Winners claim payouts using Merkle proofs

## 📋 Contract Architecture

The contracts use a **layered inheritance pattern** adapted from the existing Vault system:

```
PredictionMarketStorage (storage definitions)
    ↓
PredictionMarketState (state management + ownership)
    ↓
PredictionMarketGetters (view functions + utilities)
    ↓
PredictionMarketCore (market logic + resolution)

Treasury (ERC20 with controlled minting)
WormholeReceiver (VAA processing + bet forwarding)
```

### Core Contracts

- **`PredictionMarketCore.sol`** - Main market logic: creation, betting, resolution, claims
- **`Treasury.sol`** - ERC20 token that mints on bets and transfers on claims
- **`WormholeReceiver.sol`** - Receives and processes bet VAAs from Aztec
- **`PredictionMarketState.sol`** - Base contract managing state and ownership
- **`PredictionMarketGetters.sol`** - Provides read-only access to contract state

## 🎯 Key Features

### Market Types
- **Public Markets**: All markets have explicit admin addresses for resolution (private market functionality was removed for simplicity)

### Betting System
- **Cross-chain Bets**: Received via Wormhole from Aztec
- **Replay Protection**: Unique `betId` prevents duplicate processing
- **Commitment Scheme**: Users bet with `commitment = keccak256(marketId, secret)` for privacy preservation

### Resolution & Claims
- **Merkle Tree Payouts**: Off-chain builder calculates winners and creates Merkle tree
- **Verifiable Claims**: Users prove winnings with Merkle proofs
- **Privacy Preserved**: Identity not exposed during claims

## 🔒 Security Features

- **Fork Detection** - Prevents operation if copied to wrong network using chain ID validation
- **Emitter Authorization** - Only accepts VAAs from registered Aztec contracts via `setRegisteredSender()`
- **Replay Protection** - Tracks processed bet IDs and delivery hashes to prevent double processing
- **Chain Validation** - Uses both Wormhole and EVM chain IDs for verification
- **Ownership Architecture** - Deployer → WormholeReceiver → PredictionMarketCore → Treasury
- **Standard Wormhole Integration** - Uses `IWormholeReceiver` interface with `onlyRelayer` access control
- **Commitment Privacy** - Users maintain privacy through secret-based commitments

## ⚙️ Chain Configuration

### Wormhole Chain IDs
- **Arbitrum Sepolia**: `10003`
- **Aztec**: `56`

### EVM Chain IDs
- **Local Anvil**: `31337`
- **Arbitrum Sepolia**: `421614`

## 🚀 Deployment

### Prerequisites
```bash
# Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
cd packages/evm
forge install
```

### Environment Setup
```bash
# Copy environment template (if exists)
cp .env.example .env

# Create .env with required values
PRIVATE_KEY=your_private_key_here
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# Optional overrides (uses official addresses by default)
WORMHOLE_ADDRESS=0x6b9C8671cdDC8dEab9c719bB87cBd3e782bA6a35
WORMHOLE_RELAYER_ADDRESS=0x7B1bD7a6b4E61c2a123AC6BC2cbfC614437D0470
AZTEC_EMITTER_ADDRESS=0x... # Required for production, has default for local testing
```

### Local Deployment (Anvil)
```bash
# Start local node
anvil --host 0.0.0.0 --port 8545

# Deploy contracts (automatically detects local network)
forge script script/DeployPredictionMarket.s.sol --fork-url http://localhost:8545 --broadcast
```

### Arbitrum Sepolia Deployment
```bash
# Deploy to testnet (requires AZTEC_EMITTER_ADDRESS for production)
AZTEC_EMITTER_ADDRESS=0x... forge script script/DeployPredictionMarket.s.sol \
    --fork-url $ARBITRUM_SEPOLIA_RPC_URL \
    --broadcast
```

**⚠️ Notes**:
- Get testnet ETH from [Arbitrum Sepolia Faucet](https://faucet.quicknode.com/arbitrum/sepolia)
- Set `AZTEC_EMITTER_ADDRESS` to your deployed Aztec contract address for production

## 🔧 Contract Interactions

### Market Creation
```solidity
// Create market (all markets are public)
uint256 marketId = predictionMarketCore.createMarket("Will BTC hit $100k?");
// Returns auto-incremental ID: 1, 2, 3, etc.
```

### Processing Bets (via Wormhole)
```solidity
// Called by WormholeReceiver when VAA is received
predictionMarketCore.processBet(marketId, betId, outcome, amount, commitment);
```

### Market Resolution
```solidity
// Set winners root (calculated off-chain)
predictionMarketCore.setWinnersRoot(marketId, merkleRoot);
```

### Claiming Payouts
```solidity
// Users claim with Merkle proof
predictionMarketCore.claim(marketId, payout, proof, secret, recipientAddress);
```

## 🛠️ Development

### Build
```bash
forge build
```

### Test
```bash
forge test
```

### Format
```bash
forge fmt
```

## 📊 Market Resolution Model

The system implements a **pari-mutuel** betting model:

```
payout_i = (amount_i / totalWinners) × totalPool
```

Where:
- `amount_i` = individual bet amount
- `totalWinners` = total amount bet on winning outcome
- `totalPool` = total amount bet across all outcomes

This ensures proportional distribution where each winner receives their bet plus a proportional share of losing bets.

## 🔄 Off-chain Components Required

### Builder Service
- Monitors bet events on Arbitrum
- Calculates payouts using pari-mutuel rules
- Builds Merkle tree with `leaves = H(commitment, payout)`
- Publishes root to `PredictionMarketCore`
- Exposes manifest API for users to get proofs

### Watcher (Aztec Side)
- Listens to bet events from Aztec
- Formats and submits to Wormhole guardians

### Relayer
- Collects signed VAAs from guardians
- Submits to `WormholeReceiver` on Arbitrum

## 🎯 Integration with Existing System

This EVM package is designed to integrate with:
- **`packages/avm/`** - Aztec contracts for private betting
- **`packages/frontend/`** - UI for market interaction
- **Future relayer service** - Cross-chain message handling

## ⚠️ Common Issues

**"ChainIdMismatch"**
- Verify you're on the correct network (Local: 31337, Arbitrum Sepolia: 421614)
- Contract detects when running on wrong chain for security

**"Not registered sender"**
- Register the Aztec emitter with `setRegisteredSender(56, aztecEmitterAddress)`
- Only registered Aztec contracts can send bets via Wormhole

**"Only the Wormhole relayer can call this function"**
- `receiveWormholeMessages()` can only be called by the WormholeRelayer contract

**"Bet already processed" / "MessageAlreadyProcessed"**
- Each bet needs a unique `betId` and `deliveryHash` to prevent replay attacks

**"Market not resolved yet"**
- Claims can only be made after `setWinnersRoot()` is called by market admin

## 📚 Additional Resources

- [Foundry Documentation](https://book.getfoundry.sh/)
- [Wormhole Documentation](https://docs.wormhole.com/)
- [Arbitrum Documentation](https://docs.arbitrum.io/)
- [Project Architecture Documentation](../docs/prediction-market-status-extended.md)