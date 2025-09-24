/**
 * @fileoverview Market route index
 * Exports the market routes with their handlers bound
 *
 * @module interfaces/http/routes/market/index
 */

import { createRouter } from "../../../../lib/create-app";
import { getMarketByIdRoute } from "./market.routes";
import { MarketHandler } from "./market.handler";
import { createContainer, TYPES } from "../../../../container/bindings";

/**
 * Creates and configures the market router
 */
function createMarketRouter() {
  const app = createRouter();
  const container = createContainer();

  // Resolve handler from DI container
  const marketHandler = container.resolve<MarketHandler>(TYPES.MarketHandler);

  // Register routes
  app.openapi(getMarketByIdRoute, marketHandler.getById);

  return app;
}

/**
 * Market routes with handlers
 */
const marketRoutes = createMarketRouter();

export default marketRoutes;