# Private Markets

Cross-chain private prediction market: Aztec (private bets) + Arbitrum (public resolution) + Wormhole (messaging).

## Prerequisites

- **Node.js** >= 18
- **Docker** (for Wormhole Spy)
- **Go** >= 1.21 (for relayer)
- **Foundry** (`curl -L https://foundry.paradigm.xyz | bash`)
- **Aztec CLI** (`npm install -g @aztec/cli`) - for sandbox only

## Packages

| Package | Description |
|---------|-------------|
| `packages/avm` | Aztec contracts (Token + BetVault) |
| `packages/evm` | Solidity contracts (PredictionMarket + Treasury) |
| `packages/frontend` | Next.js application |
| `packages/relayer` | Go relayer for Wormhole VAAs |

## Quick Start

### 1. Aztec Contracts

```bash
cd packages/avm

# Build contracts (compiles + copies Wormhole artifact + generates TypeScript bindings)
npm run build

# Deploy to sandbox (requires aztec start --sandbox running)
npm run sandbox:deploy:all

# Deploy to devnet (optionally specify minter address for frontend minting)
MINTER_ADDRESS=0x... npm run deploy:all
```

The `MINTER_ADDRESS` is authorized to mint tokens from the frontend. If not specified, defaults to the deployer address.

#### Deployment Artifacts

Deploy scripts save state to `deployments/{network}/`:

```
deployments/
├── sandbox/
│   ├── accounts.json    # Deployed account addresses
│   ├── contracts.json   # Deployed contract addresses
│   └── keys.json        # Private keys (gitignored)
└── testnet/
    ├── accounts.json
    ├── contracts.json
    └── keys.json
```

- **keys.json**: Auto-generated on first deploy (gitignored)
- **accounts.json**: Deployer account addresses
- **contracts.json**: Token and Vault addresses

### 2. EVM Contracts (Arbitrum Sepolia)

Create `packages/evm/.env`:

```
TESTNET_PRIVATE_KEY=your_private_key_here
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
AZTEC_EMITTER_ADDRESS=0x2b13cff4daef709134419f1506ccae28956e02102a5ef5f2d0077e4991a9f493  # Wormhole core contract on Aztec
```

```bash
# From project root
npm run evm:build
npm run evm:deploy:testnet
```

At this point, contracts are deployed on both chains. Next: set up the relayer to bridge Wormhole VAAs.

### 3. Relayer

The relayer bridges Wormhole VAAs between Aztec and Arbitrum. When a user places a bet on Aztec, the transaction is included in a block and Wormhole guardians sign the VAA. The relayer listens for these VAAs and submits them to Arbitrum.

**Note:** On testnet, expect ~15 minutes between a transaction appearing in a preconfirmed Aztec block and the VAA being available in the relayer. This is the guardian consensus time on testnet.

It requires two services running:
- **Wormhole Spy**: Connects to the guardian P2P network and streams signed VAAs
- **Relayer**: Filters VAAs by emitter, parses the payload, and submits to WormholeReceiver on Arbitrum

#### Configuration

Copy `.env.example` to `.env` and set your private key:

```bash
cd packages/relayer
cp .env.example .env
# Edit .env and set PRIVATE_KEY
```

#### Run Spy Service

The spy connects to Wormhole's testnet guardian network:

```bash
docker run --platform=linux/amd64 \
  -p 7073:7073 \
  --entrypoint /guardiand \
  ghcr.io/wormhole-foundation/guardiand:v2.23.0 \
  spy \
  --nodeKey /node.key \
  --spyRPC "[::]:7073" \
  --network /wormhole/testnet/2/1 \
  --bootstrap /dns4/wormhole-testnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWBY9ty9CXLBXGQzMuqkziLntsVcyz4pk1zWaJRvJn6Mmt
```

#### Run Relayer

```bash
cd packages/relayer
LOG_LEVEL=info go run relayer.go
```

The relayer will log received VAAs and submit them to Arbitrum. You should see colored output showing the parsed payload structure (msgType, marketId, betId, amount).



### 4. Frontend

Create `packages/frontend/.env.local` with the deployed contract addresses:

```
# Aztec Configuration
NEXT_PUBLIC_PXE_URL=https://devnet.aztec-labs.com
NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS=0x0f46afec78d39de56e2d8406fafa3d2a326a78ea847c45ff10fc67e7ee20d0b6
NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS=0x14ecfc7bbfbff04e6553402f098760270b030a93d568ae01a2aaf8464c2c5689
NEXT_PUBLIC_WORMHOLE_CONTRACT_ADDRESS=0x2b13cff4daef709134419f1506ccae28956e02102a5ef5f2d0077e4991a9f493

# EVM Configuration
NEXT_PUBLIC_USDC_ADDRESS=0x4aaB05112eCDba70b99Ab05002ec9f492E7bba8e
NEXT_PUBLIC_TREASURY_ADDRESS=0x7110de46A4301a5F37043736e764E66199B88852
NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS=0x7AD0dADAbEEdC8EE664D3f11ef9B4507b71d0920
NEXT_PUBLIC_WORMHOLE_RECEIVER_CONTRACT_ADDRESS=0x01Bae5afDBCc24c4C903c7A323CE85A7A0791939
```

```bash
cd packages/frontend
npm install
npm run dev
```

### 5. Load Aztec Account

To use an existing Aztec account (deployer/executor) in the frontend, export it for localStorage:

```bash
cd packages/avm
npm run export:account -- executor          # testnet
npm run sandbox:export:account -- deployer  # sandbox
```

Paste the output in the browser console. The frontend will detect the account on refresh.

### 6. Mint Tokens

To place bets, users need tokens on both chains: Aztec tokens for private bets, USDC on Arbitrum for market creation and payouts.

#### From the UI (Recommended)

You can mint tokens for both Aztec and Arbitrum directly from the frontend:

1. Click the **three dots menu** (Token Actions) in the header
2. **Aztec section**: Enter amount and click "Mint Tokens" (uses connected Aztec wallet as recipient)
3. **EVM section**: Enter amount and click "Mint EVM Tokens" (uses connected MetaMask wallet as recipient)

> **Note**: After minting, you may need to refresh the page for the balance to update.

#### CLI Alternative

<details>
<summary>Aztec (CLI)</summary>

```bash
cd packages/avm
npm run sandbox:interact:mint   # sandbox
npm run interact:mint           # devnet
```
</details>

<details>
<summary>Arbitrum (CLI)</summary>

Update `packages/evm/script/MintTokens.s.sol`:

```solidity
address constant TOKEN = 0x4aaB05112eCDba70b99Ab05002ec9f492E7bba8e;
address constant RECIPIENT = 0xYourAddress;
uint256 constant AMOUNT = 1000000000000000000000000;  // 1,000,000 tokens
```

```bash
# From project root
npm run evm:mint:testnet
```
</details>

## Deployed Contracts (Devnet)

### Aztec

```
TOKEN_CONTRACT_ADDRESS=0x2e423e77e5ba229ba12ee5b8b3a731f446172c34c97ae717bfcad5bea9f55611
VAULT_CONTRACT_ADDRESS=0x112783b081e36108def69e7bc254482c0993cd29a4b6174d97de1706a724da26
WORMHOLE_CONTRACT_ADDRESS=0x2b13cff4daef709134419f1506ccae28956e02102a5ef5f2d0077e4991a9f493
```

### Arbitrum Sepolia

```
USDC_ADDRESS=0x4aaB05112eCDba70b99Ab05002ec9f492E7bba8e
TREASURY_ADDRESS=0x7110de46A4301a5F37043736e764E66199B88852
PREDICTION_MARKET_ADDRESS=0x7AD0dADAbEEdC8EE664D3f11ef9B4507b71d0920
WORMHOLE_RECEIVER_ADDRESS=0x01Bae5afDBCc24c4C903c7A323CE85A7A0791939
```
