/**
 * @fileoverview Market route definitions
 * Defines the OpenAPI schema for the market endpoints.
 *
 * @module interfaces/http/market/routes
 */

import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { GetMarketResponseSchema } from "../../../application/dto/GetMarketResponse";

/**
 * Parameter schema for market ID
 */
const MarketIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()),
});

/**
 * Get market by ID route configuration
 * @description Defines a GET endpoint that retrieves a market by its ID
 *
 * @openapi
 * /market/{id}:
 *   get:
 *     tags:
 *       - Market
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: The market ID to retrieve
 *     responses:
 *       200:
 *         description: Market found and returned successfully
 *       400:
 *         description: Invalid market ID provided
 *       404:
 *         description: Market not found
 */
export const getMarketByIdRoute = createRoute({
  path: "/market/{id}",
  method: "get",
  tags: ["Market"],
  request: {
    params: MarketIdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      GetMarketResponseSchema,
      "Market retrieved successfully",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("Invalid market ID provided"),
      "Bad Request"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("Market not found"),
      "Not Found"
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Internal server error"),
      "Internal Server Error"
    ),
  },
});

/**
 * Get market bets route configuration
 * @description Defines a GET endpoint that retrieves all bets for a market
 *
 * @openapi
 * /market/{id}/bets:
 *   get:
 *     tags:
 *       - Market
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: The market ID to retrieve bets for
 *     responses:
 *       200:
 *         description: Bets retrieved successfully
 *       400:
 *         description: Invalid market ID provided
 *       404:
 *         description: Market not found
 */
export const getMarketBetsRoute = createRoute({
  path: "/market/{id}/bets",
  method: "get",
  tags: ["Market"],
  request: {
    params: MarketIdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        marketId: z.number(),
        bets: z.array(z.object({
          commitment: z.string(),
          amount: z.string(),
          outcome: z.boolean(),
          outcomeLabel: z.string(),
          betId: z.string(),
          blockNumber: z.number(),
          timestamp: z.string()
        })),
        totalBets: z.number(),
        totalYes: z.number(),
        totalNo: z.number(),
        totalAmountYes: z.string(),
        totalAmountNo: z.string()
      }),
      "Market bets retrieved successfully",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("Invalid market ID provided"),
      "Bad Request"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("Market not found"),
      "Not Found"
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Internal server error"),
      "Internal Server Error"
    ),
  },
});

export type GetMarketByIdRoute = typeof getMarketByIdRoute;
export type GetMarketBetsRoute = typeof getMarketBetsRoute;