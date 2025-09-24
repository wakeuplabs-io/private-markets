/**
 * @fileoverview Market route definitions
 * Defines the OpenAPI schema for the market endpoints.
 *
 * @module interfaces/http/routes/market/routes
 */

import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { GetMarketResponseSchema } from "../../../../application/dto/GetMarketResponse";

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
  },
});

export type GetMarketByIdRoute = typeof getMarketByIdRoute;