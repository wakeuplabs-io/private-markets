/**
 * @fileoverview Market route handler implementation
 * Contains the business logic for the market endpoints.
 *
 * @module interfaces/http/routes/market/handler
 */

import * as HttpStatusCodes from "stoker/http-status-codes";
import { AppRouteHandler } from "../../../../lib/types";
import { GetMarketByIdRoute } from "./market.routes";
import { GetMarketById, MarketNotFoundError } from "../../../../application/use-cases/GetMarketById";

/**
 * Handler for the get market by ID endpoint
 */
export class MarketHandler {
  constructor(private getMarketByIdUseCase: GetMarketById) {}

  /**
   * GET /market/:id endpoint handler
   * @type {AppRouteHandler<GetMarketByIdRoute>}
   * @description Handles GET requests to retrieve a market by ID
   *
   * @param {import('hono').Context} c - The Hono context object
   * @returns {Promise<Response>} JSON response with market data or error
   */
  getById: AppRouteHandler<GetMarketByIdRoute> = async (c) => {
    try {
      const { id } = c.req.valid("param");

      c.var.logger.info({ marketId: id }, "Retrieving market by ID");

      const market = await this.getMarketByIdUseCase.execute(id);

      c.var.logger.info({ marketId: id, status: market.status }, "Market retrieved successfully");

      return c.json(market, HttpStatusCodes.OK);
    } catch (error) {
      if (error instanceof MarketNotFoundError) {
        c.var.logger.warn({ marketId: c.req.param("id") }, "Market not found");

        return c.json(
          { message: error.message },
          HttpStatusCodes.NOT_FOUND
        );
      }

      if (error instanceof Error && error.message.includes("positive integer")) {
        c.var.logger.warn({ marketId: c.req.param("id") }, "Invalid market ID provided");

        return c.json(
          { message: "Market ID must be a positive integer" },
          HttpStatusCodes.BAD_REQUEST
        );
      }

      // Log unexpected errors
      c.var.logger.error(
        { error: error instanceof Error ? error.message : String(error), marketId: c.req.param("id") },
        "Unexpected error retrieving market"
      );

      return c.json(
        { message: "Internal server error" },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };
}