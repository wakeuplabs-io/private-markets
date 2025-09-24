/**
 * @fileoverview Vitest setup file
 * Configures test environment before running tests
 */

// Set up test environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.RPC_URL = 'mock://localhost:8545';
process.env.PREDICTION_MARKET_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
process.env.CHAIN_ID = '31337';
process.env.START_BLOCK = '0';
process.env.PORT = '9999';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGINS = 'http://localhost:3000';