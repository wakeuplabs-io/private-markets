/**
 * @fileoverview Service bindings configuration
 * Configures all service dependencies and their relationships
 *
 * @module container/bindings
 */

import { Container } from './Container';
import { IMarketRepository } from '../domain/repositories/IMarketRepository';
import { InMemoryMarketRepository } from '../infrastructure/persistence/InMemoryMarketRepository';
import { GetMarketById } from '../application/use-cases/GetMarketById';
import { MarketHandler } from '../interfaces/http/routes/market/market.handler';

/**
 * Service identifiers
 */
export const TYPES = {
  // Repositories
  MarketRepository: 'MarketRepository',

  // Use Cases
  GetMarketById: 'GetMarketById',

  // Handlers
  MarketHandler: 'MarketHandler',
} as const;

/**
 * Configures all service bindings for the application
 * @param container - The DI container to configure
 */
export function configureContainer(container: Container): void {
  // Register repositories as singletons
  container.registerSingleton<IMarketRepository>(
    TYPES.MarketRepository,
    () => new InMemoryMarketRepository()
  );

  // Register use cases
  container.register<GetMarketById>(
    TYPES.GetMarketById,
    () => new GetMarketById(
      container.resolve<IMarketRepository>(TYPES.MarketRepository)
    )
  );

  // Register handlers
  container.register<MarketHandler>(
    TYPES.MarketHandler,
    () => new MarketHandler(
      container.resolve<GetMarketById>(TYPES.GetMarketById)
    )
  );
}

/**
 * Creates and configures a new container with all bindings
 * @returns Configured container instance
 */
export function createContainer(): Container {
  const container = new Container();
  configureContainer(container);
  return container;
}