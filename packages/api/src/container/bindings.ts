/**
 * @fileoverview Service bindings configuration
 * Configures all service dependencies and their relationships
 *
 * @module container/bindings
 */

import { Container } from './Container';
import { IMarketRepository } from '../domain/repositories/IMarketRepository';
import { IBetRepository } from '../domain/repositories/IBetRepository';
import { IResolutionRepository } from '../domain/repositories/IResolutionRepository';
import { ICheckpointRepository } from '../domain/repositories/ICheckpointRepository';
import { IBlockchainService } from '../domain/services/IBlockchainService';
import { IMerkleService } from '../domain/services/IMerkleService';
import { InMemoryMarketRepository } from '../infrastructure/persistence/InMemoryMarketRepository';
import { InMemoryBetRepository } from '../infrastructure/persistence/InMemoryBetRepository';
import { InMemoryResolutionRepository } from '../infrastructure/persistence/InMemoryResolutionRepository';
import { InMemoryCheckpointRepository } from '../infrastructure/persistence/InMemoryCheckpointRepository';
import { ViemBlockchainService, type BlockchainServiceConfig } from '../infrastructure/blockchain/ViemBlockchainService';
import { MerkleTreeService } from '../infrastructure/services/MerkleTreeService';
import { GetMarketById } from '../application/use-cases/GetMarketById';
import { GetMarketBets } from '../application/use-cases/GetMarketBets';
import { StoreBet } from '../application/use-cases/StoreBet';
import { ResolveMarket } from '../application/use-cases/ResolveMarket';
import { GetProofByCommitment } from '../application/use-cases/GetProofByCommitment';
import { GetMarketStatus } from '../application/use-cases/GetMarketStatus';
import { ScanHistoricalEvents } from '../application/use-cases/ScanHistoricalEvents';
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
  ResolutionRepository: 'ResolutionRepository',
  CheckpointRepository: 'CheckpointRepository',

  // Services
  BlockchainService: 'BlockchainService',
  MerkleService: 'MerkleService',

  // Use Cases
  GetMarketById: 'GetMarketById',
  GetMarketBets: 'GetMarketBets',
  StoreBet: 'StoreBet',
  ResolveMarket: 'ResolveMarket',
  GetProofByCommitment: 'GetProofByCommitment',
  GetMarketStatus: 'GetMarketStatus',
  ScanHistoricalEvents: 'ScanHistoricalEvents',

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

  container.registerSingleton<IResolutionRepository>(
    TYPES.ResolutionRepository,
    () => new InMemoryResolutionRepository(container.resolve<Logger>(TYPES.Logger))
  );

  container.registerSingleton<ICheckpointRepository>(
    TYPES.CheckpointRepository,
    () => new InMemoryCheckpointRepository(container.resolve<Logger>(TYPES.Logger))
  );

  // Register services
  container.registerSingleton<IMerkleService>(
    TYPES.MerkleService,
    () => new MerkleTreeService(container.resolve<Logger>(TYPES.Logger))
  );

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
      const checkpointRepository = container.resolve<ICheckpointRepository>(TYPES.CheckpointRepository);
      return new ViemBlockchainService(config, eventHandler, container.resolve<Logger>(TYPES.Logger), checkpointRepository);
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

  container.register<ResolveMarket>(
    TYPES.ResolveMarket,
    () => new ResolveMarket(
      container.resolve<IMarketRepository>(TYPES.MarketRepository),
      container.resolve<IBetRepository>(TYPES.BetRepository),
      container.resolve<IResolutionRepository>(TYPES.ResolutionRepository),
      container.resolve<IMerkleService>(TYPES.MerkleService),
      container.resolve<Logger>(TYPES.Logger)
    )
  );

  container.register<GetProofByCommitment>(
    TYPES.GetProofByCommitment,
    () => new GetProofByCommitment(
      container.resolve<IResolutionRepository>(TYPES.ResolutionRepository),
      container.resolve<Logger>(TYPES.Logger)
    )
  );

  container.register<GetMarketStatus>(
    TYPES.GetMarketStatus,
    () => new GetMarketStatus(
      container.resolve<IMarketRepository>(TYPES.MarketRepository),
      container.resolve<IBetRepository>(TYPES.BetRepository),
      container.resolve<IResolutionRepository>(TYPES.ResolutionRepository),
      container.resolve<Logger>(TYPES.Logger)
    )
  );

  container.register<ScanHistoricalEvents>(
    TYPES.ScanHistoricalEvents,
    () => new ScanHistoricalEvents(
      container.resolve<IBlockchainService>(TYPES.BlockchainService),
      container.resolve<ICheckpointRepository>(TYPES.CheckpointRepository),
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
      container.resolve<GetMarketBets>(TYPES.GetMarketBets),
      container.resolve<ResolveMarket>(TYPES.ResolveMarket),
      container.resolve<GetProofByCommitment>(TYPES.GetProofByCommitment),
      container.resolve<GetMarketStatus>(TYPES.GetMarketStatus),
      container.resolve<ScanHistoricalEvents>(TYPES.ScanHistoricalEvents),
      container.resolve<IBlockchainService>(TYPES.BlockchainService),
      container.resolve<ICheckpointRepository>(TYPES.CheckpointRepository)
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