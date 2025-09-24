/**
 * @fileoverview Market route handler implementation
 * Contains the business logic for the market endpoints.
 *
 * @module interfaces/http/market/handler
 */

import * as HttpStatusCodes from "stoker/http-status-codes";
import { AppRouteHandler } from "../../../lib/types";
import { GetMarketByIdRoute, GetMarketBetsRoute } from "./market.routes";
import { GetMarketById, MarketNotFoundError } from "../../../application/use-cases/GetMarketById";
import { GetMarketBets } from "../../../application/use-cases/GetMarketBets";

/**
 * Handler for market endpoints
 */
export class MarketHandler {
  constructor(
    private getMarketByIdUseCase: GetMarketById,
    private getMarketBetsUseCase: GetMarketBets
  ) {}

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

  /**
   * GET /market/:id/bets endpoint handler
   * @type {AppRouteHandler<GetMarketBetsRoute>}
   * @description Handles GET requests to retrieve all bets for a market
   *
   * @param {import('hono').Context} c - The Hono context object
   * @returns {Promise<Response>} JSON response with market bets data or error
   */
  getBets: AppRouteHandler<GetMarketBetsRoute> = async (c) => {
    try {
      const { id } = c.req.valid("param");

      c.var.logger.info({ marketId: id }, "Retrieving bets for market");

      const marketBets = await this.getMarketBetsUseCase.execute(id);

      c.var.logger.info({
        marketId: id,
        betCount: marketBets.totalBets,
        totalYes: marketBets.totalYes,
        totalNo: marketBets.totalNo
      }, "Market bets retrieved successfully");

      return c.json(marketBets, HttpStatusCodes.OK);
    } catch (error) {
      if (error instanceof Error && error.message.includes("positive integer")) {
        c.var.logger.warn({ marketId: c.req.param("id") }, "Invalid market ID provided for bets");

        return c.json(
          { message: "Market ID must be a positive integer" },
          HttpStatusCodes.BAD_REQUEST
        );
      }

      // Log unexpected errors
      c.var.logger.error(
        { error: error instanceof Error ? error.message : String(error), marketId: c.req.param("id") },
        "Unexpected error retrieving market bets"
      );

      return c.json(
        { message: "Internal server error" },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };
}