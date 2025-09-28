/**
 * @fileoverview Market route index
 * Exports the market routes with their handlers bound
 *
 * @module interfaces/http/market/index
 */

import { createRouter } from "../../../lib/create-app";
import {
  getMarketByIdRoute,
  getMarketBetsRoute,
  resolveMarketRoute,
  getProofByCommitmentRoute,
  getMarketStatusRoute,
  systemRefreshRoute,
  systemHealthRoute
} from "./market.routes";
import { MarketHandler } from "./market.handler";
import { createContainer, TYPES } from "../../../container/bindings";
import { Container } from "../../../container/Container";
import type { Logger } from 'pino';

/**
 * Creates and configures the market router with given logger
 * @param logger - Pino logger instance
 */
export function createMarketRouter(logger: Logger) {
  const app = createRouter();

  const container = createContainer(logger);

  // Resolve handler from DI container
  const marketHandler = container.resolve<MarketHandler>(TYPES.MarketHandler);

  // Register routes
  app.openapi(getMarketByIdRoute, marketHandler.getById);
  app.openapi(getMarketBetsRoute, marketHandler.getBets);
  app.openapi(resolveMarketRoute, marketHandler.resolve);
  app.openapi(getProofByCommitmentRoute, marketHandler.getProof);
  app.openapi(getMarketStatusRoute, marketHandler.getStatus);
  app.openapi(systemRefreshRoute, marketHandler.systemRefresh);
  app.openapi(systemHealthRoute, marketHandler.systemHealth);

  return app;
}

/**
 * Creates and configures the market router with existing container
 * @param container - Existing DI container to use
 */
export function createMarketRouterWithContainer(container: Container) {
  const app = createRouter();

  // Resolve handler from provided container
  const marketHandler = container.resolve<MarketHandler>(TYPES.MarketHandler);

  // Register routes
  app.openapi(getMarketByIdRoute, marketHandler.getById);
  app.openapi(getMarketBetsRoute, marketHandler.getBets);
  app.openapi(resolveMarketRoute, marketHandler.resolve);
  app.openapi(getProofByCommitmentRoute, marketHandler.getProof);
  app.openapi(getMarketStatusRoute, marketHandler.getStatus);
  app.openapi(systemRefreshRoute, marketHandler.systemRefresh);
  app.openapi(systemHealthRoute, marketHandler.systemHealth);

  return app;
}

/**
 * Default export for backward compatibility
 * This will be replaced by the factory function approach
 */
export default function createDefaultMarketRouter() {
  throw new Error('Use createMarketRouter(logger) factory function instead');
};