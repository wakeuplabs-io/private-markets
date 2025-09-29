/**
 * @fileoverview Market route handler implementation
 * Contains the business logic for the market endpoints.
 *
 * @module interfaces/http/market/handler
 */

import * as HttpStatusCodes from "stoker/http-status-codes";
import { AppRouteHandler } from "../../../lib/types";
import {
  GetMarketByIdRoute,
  GetMarketBetsRoute,
  ResolveMarketRoute,
  GetProofByCommitmentRoute,
  GetMarketStatusRoute,
  SystemRefreshRoute,
  SystemHealthRoute
} from "./market.routes";
import { GetMarketById, MarketNotFoundError } from "../../../application/use-cases/GetMarketById";
import { GetMarketBets } from "../../../application/use-cases/GetMarketBets";
import { ResolveMarket, MarketResolutionError } from "../../../application/use-cases/ResolveMarket";
import { GetProofByCommitment, ProofRetrievalError } from "../../../application/use-cases/GetProofByCommitment";
import { GetMarketStatus } from "../../../application/use-cases/GetMarketStatus";
import { ScanHistoricalEvents, HistoricalScanError } from "../../../application/use-cases/ScanHistoricalEvents";
import { IBlockchainService } from "../../../domain/services/IBlockchainService";
import { ICheckpointRepository } from "../../../domain/repositories/ICheckpointRepository";

/**
 * Handler for market endpoints
 */
export class MarketHandler {
  private startTime = new Date();

  constructor(
    private getMarketByIdUseCase: GetMarketById,
    private getMarketBetsUseCase: GetMarketBets,
    private resolveMarketUseCase: ResolveMarket,
    private getProofByCommitmentUseCase: GetProofByCommitment,
    private getMarketStatusUseCase: GetMarketStatus,
    private scanHistoricalEventsUseCase: ScanHistoricalEvents,
    private blockchainService: IBlockchainService,
    private checkpointRepository: ICheckpointRepository
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

  /**
   * POST /market/:id/resolve endpoint handler
   * @type {AppRouteHandler<ResolveMarketRoute>}
   * @description Handles POST requests to resolve a market with winning outcome
   */
  resolve: AppRouteHandler<ResolveMarketRoute> = async (c) => {
    try {
      const { id } = c.req.valid("param");
      const { winningOutcome, adminSignature } = c.req.valid("json");

      c.var.logger.info({
        marketId: id,
        winningOutcome,
        hasAdminSignature: !!adminSignature
      }, "Resolving market");

      const resolution = await this.resolveMarketUseCase.execute({
        marketId: id,
        winningOutcome,
        adminSignature
      });

      c.var.logger.info({
        marketId: id,
        root: resolution.root,
        winnerCount: resolution.winnerCount
      }, "Market resolved successfully");

      return c.json(resolution, HttpStatusCodes.OK);
    } catch (error) {
      if (error instanceof MarketResolutionError) {
        const statusCode = error.code === 'MARKET_NOT_FOUND' ? HttpStatusCodes.NOT_FOUND :
                          error.code === 'MARKET_NOT_ACTIVE' ? HttpStatusCodes.CONFLICT :
                          HttpStatusCodes.BAD_REQUEST;

        c.var.logger.warn({
          marketId: c.req.param("id"),
          error: error.message,
          code: error.code
        }, "Market resolution failed");

        return c.json(
          { message: error.message },
          statusCode
        );
      }

      // Log unexpected errors
      c.var.logger.error({
        error: error instanceof Error ? error.message : String(error),
        marketId: c.req.param("id")
      }, "Unexpected error resolving market");

      return c.json(
        { message: "Internal server error" },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * GET /proof/:commitment endpoint handler
   * @type {AppRouteHandler<GetProofByCommitmentRoute>}
   * @description Handles GET requests to retrieve Merkle proof by commitment
   */
  getProof: AppRouteHandler<GetProofByCommitmentRoute> = async (c) => {
    try {
      const { commitment } = c.req.valid("param");

      c.var.logger.info({
        commitment: commitment.slice(0, 10) + '...'
      }, "Retrieving proof for commitment");

      const proof = await this.getProofByCommitmentUseCase.execute(commitment);

      c.var.logger.info({
        commitment: commitment.slice(0, 10) + '...',
        found: proof.found,
        marketId: proof.marketId
      }, "Proof retrieval completed");

      return c.json(proof, HttpStatusCodes.OK);
    } catch (error) {
      if (error instanceof ProofRetrievalError) {
        c.var.logger.warn({
          commitment: c.req.param("commitment")?.slice(0, 10) + '...',
          error: error.message,
          code: error.code
        }, "Proof retrieval failed");

        return c.json(
          { message: error.message },
          HttpStatusCodes.BAD_REQUEST
        );
      }

      c.var.logger.error({
        error: error instanceof Error ? error.message : String(error),
        commitment: c.req.param("commitment")?.slice(0, 10) + '...'
      }, "Unexpected error retrieving proof");

      return c.json(
        { message: "Internal server error" },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * GET /market/:id/status endpoint handler
   * @type {AppRouteHandler<GetMarketStatusRoute>}
   * @description Handles GET requests to retrieve market status
   */
  getStatus: AppRouteHandler<GetMarketStatusRoute> = async (c) => {
    try {
      const { id } = c.req.valid("param");

      c.var.logger.info({ marketId: id }, "Retrieving market status");

      const status = await this.getMarketStatusUseCase.execute(id);

      c.var.logger.info({
        marketId: id,
        resolved: status.resolved,
        betsCount: status.betsCount,
        winningOutcome: status.winningOutcome
      }, "Market status retrieved successfully");

      return c.json(status, HttpStatusCodes.OK);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        c.var.logger.warn({ marketId: c.req.param("id") }, "Market not found for status");

        return c.json(
          { message: "Market not found" },
          HttpStatusCodes.NOT_FOUND
        );
      }

      if (error instanceof Error && error.message.includes("positive integer")) {
        c.var.logger.warn({ marketId: c.req.param("id") }, "Invalid market ID provided for status");

        return c.json(
          { message: "Market ID must be a positive integer" },
          HttpStatusCodes.BAD_REQUEST
        );
      }

      // Log unexpected errors
      c.var.logger.error({
        error: error instanceof Error ? error.message : String(error),
        marketId: c.req.param("id")
      }, "Unexpected error retrieving market status");

      return c.json(
        { message: "Internal server error" },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * POST /system/refresh endpoint handler
   * @type {AppRouteHandler<SystemRefreshRoute>}
   * @description Handles POST requests to refresh/recover blockchain events
   */
  systemRefresh: AppRouteHandler<SystemRefreshRoute> = async (c) => {
    try {
      const { fromBlock, toBlock, forceRescan } = c.req.valid("json");

      c.var.logger.info({
        fromBlock,
        toBlock,
        forceRescan
      }, "Starting system refresh");

      const result = await this.scanHistoricalEventsUseCase.execute({
        fromBlock,
        toBlock,
        forceRescan
      });

      c.var.logger.info({
        blocksScanned: result.blocksScanned,
        eventsProcessed: result.eventsProcessed,
        scanTimeMs: result.scanTimeMs
      }, "System refresh completed successfully");

      return c.json({
        success: true,
        ...result
      }, HttpStatusCodes.OK);

    } catch (error) {
      if (error instanceof HistoricalScanError) {
        const statusCode = error.code === 'BLOCKCHAIN_UNAVAILABLE' ? HttpStatusCodes.SERVICE_UNAVAILABLE :
                          HttpStatusCodes.BAD_REQUEST;

        c.var.logger.warn({
          error: error.message,
          code: error.code,
          details: error.details
        }, "System refresh failed");

        return c.json(
          { message: error.message },
          statusCode
        );
      }

      // Log unexpected errors
      c.var.logger.error({
        error: error instanceof Error ? error.message : String(error)
      }, "Unexpected error during system refresh");

      return c.json(
        { message: "Internal server error" },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };

  /**
   * GET /system/health endpoint handler
   * @type {AppRouteHandler<SystemHealthRoute>}
   * @description Handles GET requests to check system health and sync status
   */
  systemHealth: AppRouteHandler<SystemHealthRoute> = async (c) => {
    try {
      c.var.logger.debug("Checking system health");

      // Get blockchain connection status
      const blockchainStatus = this.blockchainService.getConnectionStatus();
      const isListening = this.blockchainService.isListening();

      let currentBlock: number | undefined;
      try {
        currentBlock = await this.blockchainService.getCurrentBlock();
      } catch (error) {
        c.var.logger.warn("Failed to get current block for health check");
      }

      // Get checkpoint information
      const checkpoint = await this.checkpointRepository.getCheckpoint();
      const checkpointRepo = this.checkpointRepository as any;
      const checkpointAge = checkpointRepo.getCheckpointAgeMinutes ?
        checkpointRepo.getCheckpointAgeMinutes() : null;

      // Calculate how far behind we are
      let behindBlocks: number | undefined;
      if (currentBlock && checkpoint?.lastProcessedBlock) {
        behindBlocks = currentBlock - checkpoint.lastProcessedBlock;
      }

      // Determine overall health status
      let status: "healthy" | "degraded" | "unhealthy";
      if (!blockchainStatus.connected || !isListening) {
        status = "unhealthy";
      } else if (behindBlocks && behindBlocks > 1000) {
        status = "degraded"; // More than 1000 blocks behind
      } else if (checkpointAge && checkpointAge > 10) {
        status = "degraded"; // Checkpoint older than 10 minutes
      } else {
        status = "healthy";
      }

      const healthData = {
        status,
        blockchain: {
          connected: blockchainStatus.connected,
          listening: isListening,
          currentBlock,
          rpcUrl: blockchainStatus.rpcUrl,
          chainId: blockchainStatus.chainId,
          contractAddress: blockchainStatus.contractAddress
        },
        sync: {
          lastProcessedBlock: checkpoint?.lastProcessedBlock,
          checkpointAge,
          totalEventsProcessed: checkpoint?.metadata?.totalEventsProcessed,
          behindBlocks
        },
        uptime: {
          uptimeMs: Date.now() - this.startTime.getTime(),
          startTime: this.startTime.toISOString()
        },
        timestamp: new Date().toISOString()
      };

      c.var.logger.info({
        status,
        currentBlock,
        lastProcessedBlock: checkpoint?.lastProcessedBlock,
        behindBlocks,
        checkpointAge
      }, "System health check completed");

      return c.json(healthData, HttpStatusCodes.OK);

    } catch (error) {
      c.var.logger.error({
        error: error instanceof Error ? error.message : String(error)
      }, "Unexpected error during health check");

      return c.json(
        { message: "Internal server error" },
        HttpStatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };
}