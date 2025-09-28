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

/**
 * Resolve market route configuration
 * @description Defines a POST endpoint for resolving markets with winning outcome
 */
export const resolveMarketRoute = createRoute({
  path: "/market/{id}/resolve",
  method: "post",
  tags: ["Market"],
  request: {
    params: MarketIdParamSchema,
    body: jsonContent(
      z.object({
        winningOutcome: z.boolean().describe("The winning outcome: true for Yes, false for No"),
        adminSignature: z.string().optional().describe("Optional admin signature for authorization")
      }),
      "Market resolution request"
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        marketId: z.number(),
        winningOutcome: z.number(),
        winningOutcomeLabel: z.string(),
        root: z.string(),
        totalWinners: z.string(),
        totalPool: z.string(),
        winnerCount: z.number(),
        resolvedAt: z.string(),
        summary: z.object({
          totalBets: z.number(),
          totalYesBets: z.number(),
          totalNoBets: z.number(),
          winningBetCount: z.number(),
          losingBetCount: z.number()
        })
      }),
      "Market resolved successfully",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("Invalid request data"),
      "Bad Request"
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      createMessageObjectSchema("Market not found"),
      "Not Found"
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      createMessageObjectSchema("Market already resolved"),
      "Conflict"
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Internal server error"),
      "Internal Server Error"
    ),
  },
});

/**
 * Get proof route configuration
 * @description Defines a GET endpoint for retrieving Merkle proofs by commitment
 */
export const getProofByCommitmentRoute = createRoute({
  path: "/proof/{commitment}",
  method: "get",
  tags: ["Proof"],
  request: {
    params: z.object({
      commitment: z.string()
        .regex(/^0x[a-fA-F0-9]{64}$/)
        .describe("The commitment hash (32-byte hex string with 0x prefix)")
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        found: z.boolean(),
        commitment: z.string().optional(),
        amount: z.string().optional(),
        proof: z.array(z.string()).optional(),
        marketId: z.number().optional(),
        outcome: z.number().optional(),
        winningOutcome: z.number().optional(),
        root: z.string().optional(),
        leafIndex: z.number().optional()
      }),
      "Proof data retrieved successfully",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("Invalid commitment format"),
      "Bad Request"
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Internal server error"),
      "Internal Server Error"
    ),
  },
});

/**
 * Market status route configuration
 * @description Defines a GET endpoint for retrieving market status including resolution data
 */
export const getMarketStatusRoute = createRoute({
  path: "/market/{id}/status",
  method: "get",
  tags: ["Market"],
  request: {
    params: MarketIdParamSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        marketId: z.number(),
        resolved: z.boolean(),
        winningOutcome: z.number().optional(),
        winningOutcomeLabel: z.string().optional(),
        root: z.string().optional(),
        totalBets: z.object({
          yes: z.string(),
          no: z.string()
        }),
        winnersCount: z.number().optional(),
        betsCount: z.number(),
        resolvedAt: z.string().optional()
      }),
      "Market status retrieved successfully",
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
 * System refresh route configuration
 * @description Defines a POST endpoint for refreshing/recovering blockchain events
 */
export const systemRefreshRoute = createRoute({
  path: "/system/refresh",
  method: "post",
  tags: ["System"],
  request: {
    body: jsonContent(
      z.object({
        fromBlock: z.number().int().min(0).optional().describe("Optional starting block number"),
        toBlock: z.number().int().min(0).optional().describe("Optional ending block number"),
        forceRescan: z.boolean().optional().default(false).describe("Force rescan of already processed blocks")
      }),
      "Event refresh request"
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean(),
        blocksScanned: z.number(),
        eventsProcessed: z.number(),
        scannedRange: z.object({
          fromBlock: z.number(),
          toBlock: z.number()
        }),
        scanTimeMs: z.number(),
        wasForceRescan: z.boolean()
      }),
      "Event refresh completed successfully",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      createMessageObjectSchema("Invalid refresh request"),
      "Bad Request"
    ),
    [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
      createMessageObjectSchema("Blockchain service unavailable"),
      "Service Unavailable"
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Internal server error"),
      "Internal Server Error"
    ),
  },
});

/**
 * System health route configuration
 * @description Defines a GET endpoint for checking system health and sync status
 */
export const systemHealthRoute = createRoute({
  path: "/system/health",
  method: "get",
  tags: ["System"],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        status: z.enum(["healthy", "degraded", "unhealthy"]),
        blockchain: z.object({
          connected: z.boolean(),
          listening: z.boolean(),
          currentBlock: z.number().optional(),
          rpcUrl: z.string(),
          chainId: z.number(),
          contractAddress: z.string()
        }),
        sync: z.object({
          lastProcessedBlock: z.number().optional(),
          checkpointAge: z.number().optional().describe("Age of last checkpoint in minutes"),
          totalEventsProcessed: z.number().optional(),
          behindBlocks: z.number().optional().describe("How many blocks behind current")
        }),
        uptime: z.object({
          uptimeMs: z.number(),
          startTime: z.string()
        }),
        timestamp: z.string()
      }),
      "System health information",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      createMessageObjectSchema("Internal server error"),
      "Internal Server Error"
    ),
  },
});

export type GetMarketByIdRoute = typeof getMarketByIdRoute;
export type GetMarketBetsRoute = typeof getMarketBetsRoute;
export type ResolveMarketRoute = typeof resolveMarketRoute;
export type GetProofByCommitmentRoute = typeof getProofByCommitmentRoute;
export type GetMarketStatusRoute = typeof getMarketStatusRoute;
export type SystemRefreshRoute = typeof systemRefreshRoute;
export type SystemHealthRoute = typeof systemHealthRoute;