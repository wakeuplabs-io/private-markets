/**
 * @fileoverview Service bindings configuration
 * Configures all service dependencies and their relationships
 *
 * @module container/bindings
 */

import { Container } from './Container';
import { IMarketRepository } from '../domain/repositories/IMarketRepository';
import { IBetRepository } from '../domain/repositories/IBetRepository';
import { IBlockchainService } from '../domain/services/IBlockchainService';
import { InMemoryMarketRepository } from '../infrastructure/persistence/InMemoryMarketRepository';
import { InMemoryBetRepository } from '../infrastructure/persistence/InMemoryBetRepository';
import { ViemBlockchainService, type BlockchainServiceConfig } from '../infrastructure/blockchain/ViemBlockchainService';
import { GetMarketById } from '../application/use-cases/GetMarketById';
import { GetMarketBets } from '../application/use-cases/GetMarketBets';
import { StoreBet } from '../application/use-cases/StoreBet';
import { MarketHandler } from '../interfaces/http/market/market.handler';
import { BlockchainEventHandler } from '../interfaces/events/BlockchainEventHandler';
import env from '../env';
import type { Logger } from 'pino';

/**
 * Service identifiers
 */
export const TYPES = {
  // Repositories
  MarketRepository: 'MarketRepository',
  BetRepository: 'BetRepository',

  // Services
  BlockchainService: 'BlockchainService',

  // Use Cases
  GetMarketById: 'GetMarketById',
  GetMarketBets: 'GetMarketBets',
  StoreBet: 'StoreBet',

  // Handlers
  MarketHandler: 'MarketHandler',
  BlockchainEventHandler: 'BlockchainEventHandler',

  // Infrastructure
  Logger: 'Logger',
} as const;

/**
 * Configures all service bindings for the application
 * @param container - The DI container to configure
 * @param logger - Pino logger instance
 */
export function configureContainer(container: Container, logger: Logger): void {
  // Register logger as singleton
  container.registerInstance<Logger>(TYPES.Logger, logger);

  // Register repositories as singletons
  container.registerSingleton<IMarketRepository>(
    TYPES.MarketRepository,
    () => new InMemoryMarketRepository()
  );

  container.registerSingleton<IBetRepository>(
    TYPES.BetRepository,
    () => new InMemoryBetRepository(container.resolve<Logger>(TYPES.Logger))
  );

  // Register blockchain service
  container.registerSingleton<IBlockchainService>(
    TYPES.BlockchainService,
    () => {
      const config: BlockchainServiceConfig = {
        rpcUrl: env.RPC_URL,
        contractAddress: env.PREDICTION_MARKET_ADDRESS as `0x${string}`,
        chainId: env.CHAIN_ID,
        startBlock: env.START_BLOCK
      };

      const eventHandler = container.resolve<BlockchainEventHandler>(TYPES.BlockchainEventHandler);
      return new ViemBlockchainService(config, eventHandler, container.resolve<Logger>(TYPES.Logger));
    }
  );

  // Register use cases
  container.register<GetMarketById>(
    TYPES.GetMarketById,
    () => new GetMarketById(
      container.resolve<IMarketRepository>(TYPES.MarketRepository)
    )
  );

  container.register<GetMarketBets>(
    TYPES.GetMarketBets,
    () => new GetMarketBets(
      container.resolve<IBetRepository>(TYPES.BetRepository),
      container.resolve<Logger>(TYPES.Logger)
    )
  );

  container.register<StoreBet>(
    TYPES.StoreBet,
    () => new StoreBet(
      container.resolve<IBetRepository>(TYPES.BetRepository),
      container.resolve<Logger>(TYPES.Logger)
    )
  );

  // Register event handlers
  container.register<BlockchainEventHandler>(
    TYPES.BlockchainEventHandler,
    () => new BlockchainEventHandler(
      container.resolve<StoreBet>(TYPES.StoreBet),
      container.resolve<Logger>(TYPES.Logger)
    )
  );

  // Register HTTP handlers
  container.register<MarketHandler>(
    TYPES.MarketHandler,
    () => new MarketHandler(
      container.resolve<GetMarketById>(TYPES.GetMarketById),
      container.resolve<GetMarketBets>(TYPES.GetMarketBets)
    )
  );
}

/**
 * Creates and configures a new container with all bindings
 * @param logger - Pino logger instance
 * @returns Configured container instance
 */
export function createContainer(logger: Logger): Container {
  const container = new Container();
  configureContainer(container, logger);
  return container;
}