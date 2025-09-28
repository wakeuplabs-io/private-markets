# Private Markets API

API service for the private prediction markets system that enables cross-chain betting between Aztec and Arbitrum Sepolia using blockchain integration via Viem.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start development server
npm run dev

# Run tests
npm test

# Run E2E tests
npm run test:e2e
```

## Architecture Overview

This API implements **Hexagonal Architecture** (Clean Architecture) with clear separation of concerns across four distinct layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Interface Layer                          │
│  HTTP Routes + Handlers + OpenAPI Documentation            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                  Application Layer                          │
│     Use Cases + DTOs + Business Logic Orchestration        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Domain Layer                              │
│    Entities + Repositories + Services (Interfaces)         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                Infrastructure Layer                         │
│  Blockchain Service + Repositories + External Services     │
└─────────────────────────────────────────────────────────────┘
```

### What Each Layer Does

#### **Interface Layer** - The API Entry Point
**When you hit an endpoint, this is what handles your request**

- **Routes** (`src/interfaces/http/`) - Define what URLs exist and what data they expect
- **Handlers** - Process the HTTP request, call business logic, return JSON response
- **Validation** - Check if incoming data is valid before processing
- **Error Handling** - Convert errors into proper HTTP status codes

#### **Application Layer** - The Business Operations
**This is where the actual work gets done**

- **Use Cases** (`src/application/use-cases/`) - One file per major operation:
  - `GetMarketById.ts` - Retrieve a single market
  - `ResolveMarket.ts` - End a market and calculate winners
  - `ScanHistoricalEvents.ts` - Sync missed blockchain events
- **DTOs** (`src/application/dto/`) - Shape data for API responses
- **Orchestration** - Coordinates between different services to complete operations

#### **Domain Layer** - The Core Business Rules
**The heart of what makes this a prediction market system**

- **Entities** (`src/domain/entities/`) - Core objects like `Market`, `BetRecord`
- **Business Logic** - Rules like "only active markets can accept bets"
- **Interfaces** - Contracts that other layers must implement (like `IMarketRepository`)
- **No External Dependencies** - This layer doesn't know about databases, APIs, or blockchain

#### **Infrastructure Layer** - The External Connections
**Everything that talks to the outside world**

- **Blockchain Service** (`src/infrastructure/blockchain/`) - Connects to Ethereum via Viem
- **Repositories** (`src/infrastructure/persistence/`) - Store and retrieve data (currently in-memory)
- **Merkle Service** (`src/infrastructure/services/`) - Generates cryptographic proofs
- **External APIs** - Any third-party integrations

## API Endpoints Analysis

### Market Operations

#### `GET /api/market/{id}` - Market Retrieval
**Implementation Flow:**
```
HTTP Handler → GetMarketById Use Case → IMarketRepository → Domain Entity → DTO Response
```
- **Business Logic**: Validates market ID, retrieves market entity, transforms to API response
- **Error Handling**: `404` for non-existent markets, `400` for invalid IDs
- **Dependencies**: Market repository, market entity validation

#### `GET /api/market/{id}/bets` - Bet Aggregation
**Implementation Flow:**
```
HTTP Handler → GetMarketBets Use Case → IBetRepository → Aggregation Logic → Statistics Response
```
- **Business Logic**: Retrieves all bets for market, calculates totals and statistics by outcome
- **Error Handling**: Graceful handling of markets with no bets
- **Dependencies**: Bet repository, market existence validation

#### `POST /api/market/{id}/resolve` - Market Resolution
**Implementation Flow:**
```
HTTP Handler → ResolveMarket Use Case → Market Validation → Merkle Tree Generation → Resolution Storage
```
- **Business Logic**:
  - Validates market is active and resolvable
  - Generates Merkle tree from winning bet commitments
  - Creates verifiable resolution with root hash
- **Error Handling**: `409` for already resolved markets, `404` for non-existent markets
- **Dependencies**: Market repository, bet repository, Merkle service, resolution storage

#### `GET /api/market/{id}/status` - Market Status
**Implementation Flow:**
```
HTTP Handler → GetMarketStatus Use Case → Market + Resolution Data → Status Response
```
- **Business Logic**: Combines market data with resolution information for comprehensive status
- **Error Handling**: Handles both resolved and unresolved market states
- **Dependencies**: Market repository, resolution repository

### Proof Operations

#### `GET /api/proof/{commitment}` - Merkle Proof Retrieval
**Implementation Flow:**
```
HTTP Handler → GetProofByCommitment Use Case → Resolution Lookup → Merkle Proof Generation
```
- **Business Logic**: Finds market resolution for commitment, generates inclusion proof
- **Error Handling**: Returns structured response for both found and not-found cases
- **Dependencies**: Resolution repository, Merkle service, commitment validation

### System Operations

#### `POST /api/system/refresh` - Historical Event Recovery
**Implementation Flow:**
```
HTTP Handler → ScanHistoricalEvents Use Case → Blockchain Service → Event Processing → Checkpoint Update
```
- **Business Logic**:
  - Scans blockchain for missed events in specified block range
  - Processes events through normal bet storage pipeline
  - Updates checkpoint to prevent re-processing
- **Error Handling**: `503` for blockchain unavailability, comprehensive scan reporting
- **Dependencies**: Blockchain service, checkpoint repository, event handlers

#### `GET /api/system/health` - Health Monitoring
**Implementation Flow:**
```
HTTP Handler → Health Check Logic → Blockchain Status + Sync Status + Uptime
```
- **Business Logic**:
  - Real-time blockchain connection status
  - Sync lag detection (blocks behind current)
  - Service uptime and checkpoint age monitoring
- **Health Levels**: `healthy`, `degraded` (>1000 blocks behind), `unhealthy` (disconnected)
- **Dependencies**: Blockchain service, checkpoint repository

## /Technical Features

### Real-time Blockchain Integration
- **WebSocket Event Listening**: Immediate processing of new bets via Viem
- **Connection Resilience**: Automatic reconnection with exponential backoff
- **Multi-chain Support**: Configurable for different networks (local/testnet/mainnet)

### Privacy & Security
- **Commitment-based Betting**: Users submit hashed commitments preserving privacy
- **Merkle Proof System**: Verifiable claims without revealing other participants
- **Replay Protection**: Prevents duplicate event processing with checkpoint system

### Monitoring & Recovery
- **Historical Event Scanning**: Recovers missed events from blockchain history
- **Health Monitoring**: Real-time system status with degradation detection
- **Comprehensive Logging**: Structured logging with request tracing

### Cross-chain Ready
- **Wormhole Integration**: Prepared for Aztec → Arbitrum message passing
- **Modular Blockchain Service**: Easy integration with different blockchain providers
- **Event-driven Architecture**: Supports multiple blockchain event sources


## Environment Configuration

```env
# API Configuration
NODE_ENV=development
PORT=9999
LOG_LEVEL=info

# Blockchain Configuration
PREDICTION_MARKET_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
RPC_URL=http://localhost:8545
CHAIN_ID=31337
START_BLOCK=0
MAX_SCAN_BLOCKS=200000
```