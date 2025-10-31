# Deployments Directory

This directory contains deployment artifacts organized by network.

## Structure

```
deployments/
├── sandbox/          # Local sandbox deployments
│   ├── contracts.json   # Deployed contract addresses
│   ├── accounts.json    # Account deployment status
│   └── keys.json        # Private keys (GITIGNORED)
└── testnet/          # Aztec testnet deployments
    ├── contracts.json   # Deployed contract addresses
    ├── accounts.json    # Account deployment status
    └── keys.json        # Private keys (GITIGNORED)
```

## Network Selection

Scripts automatically detect the network based on:

1. **`AZTEC_NETWORK`** environment variable (explicit):
   ```bash
   AZTEC_NETWORK=sandbox npm run deploy:token
   AZTEC_NETWORK=testnet npm run deploy:token
   ```

2. **`NODE_URL`** environment variable (implicit):
   ```bash
   NODE_URL=http://localhost:8080 npm run deploy:token  # sandbox
   NODE_URL=https://aztec-testnet-fullnode.zkv.xyz npm run deploy:token  # testnet
   ```

3. **Default**: testnet

## Files

### contracts.json
Stores deployed contract addresses for the network.

**Example:**
```json
{
  "token": "0x1234...",
  "vault": "0x5678..."
}
```

### accounts.json
Tracks which accounts have been deployed to the network.

**Example:**
```json
{
  "minter": true,
  "admin": true
}
```

### keys.json (SENSITIVE - GITIGNORED)
Contains private keys for deployed accounts.

**⚠️ WARNING:** This file contains sensitive cryptographic material and should NEVER be committed to git.

**Example:**
```json
{
  "minter": "0xabcd...",
  "admin": "0xef01..."
}
```

## Security

- `keys.json` is automatically gitignored in each network directory
- Contract addresses and account status are safe to commit
- Each network has isolated deployment state
- No cross-network contamination

## Usage

### Deploy to Sandbox
```bash
npm run sandbox:deploy:token
npm run sandbox:deploy:vault
```

### Deploy to Testnet
```bash
npm run deploy:token
npm run deploy:vault
```

### Check Deployments
```bash
# Sandbox
cat deployments/sandbox/contracts.json

# Testnet
cat deployments/testnet/contracts.json
```

## Migration

If you have existing deployments in `scripts/deploys/` or `scripts/deploys_testnet/`, they have been migrated to this structure during the reorganization.
