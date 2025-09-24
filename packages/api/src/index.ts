import { handle } from "hono/aws-lambda";
import { serve } from "@hono/node-server";
import env from "./env";
import app from "./app";
import { createContainer, TYPES } from "./container/bindings";
import { IBlockchainService } from "./domain/services/IBlockchainService";
import pino from "pino";

const port = env.PORT;

// Create logger for main server
const logger = pino({
  level: env.LOG_LEVEL || 'info',
  ...(env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    }
  })
});

// For AWS Lambda
export const handler = handle(app);

// For local development
if (process.env.NODE_ENV !== "production") {
  async function startServer() {
    try {
      // Create DI container with logger
      const container = createContainer(logger);

      // Start blockchain listener
      logger.info({
        rpcUrl: env.RPC_URL,
        contractAddress: env.PREDICTION_MARKET_ADDRESS,
        chainId: env.CHAIN_ID
      }, 'Initializing blockchain listener');

      const blockchainService = container.resolve<IBlockchainService>(TYPES.BlockchainService);

      await blockchainService.startListening();

      logger.info('Blockchain listener started successfully');

      // Start HTTP server
      serve({
        fetch: app.fetch,
        port,
      });

      console.log(`
  🚀 Server running!
  📝 API Documentation: http://localhost:${port}/reference
  🔥 REST API: http://localhost:${port}/api
  ⛓️  Blockchain listener: Active (${env.RPC_URL})
        `);

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error)
      }, 'Failed to start server');

      console.error('❌ Server startup failed:', error);
      process.exit(1);
    }
  }

  startServer();
}
