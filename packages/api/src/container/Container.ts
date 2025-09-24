/**
 * @fileoverview Simple Dependency Injection Container
 * Provides basic dependency injection capabilities for the application
 *
 * @module container/Container
 */

type Constructor<T = {}> = new (...args: any[]) => T;
type Factory<T = {}> = () => T;

/**
 * Simple dependency injection container
 */
export class Container {
  private services = new Map<string, any>();
  private singletons = new Map<string, any>();

  /**
   * Registers a service with a factory function
   * @param name - Service identifier
   * @param factory - Factory function that creates the service instance
   */
  register<T>(name: string, factory: Factory<T>): void {
    this.services.set(name, factory);
  }

  /**
   * Registers a service as a singleton
   * @param name - Service identifier
   * @param factory - Factory function that creates the service instance
   */
  registerSingleton<T>(name: string, factory: Factory<T>): void {
    this.services.set(name, { factory, singleton: true });
  }

  /**
   * Registers a service instance directly
   * @param name - Service identifier
   * @param instance - Service instance
   */
  registerInstance<T>(name: string, instance: T): void {
    this.singletons.set(name, instance);
  }

  /**
   * Resolves a service by name
   * @param name - Service identifier
   * @returns The service instance
   * @throws Error if service is not registered
   */
  resolve<T>(name: string): T {
    // Check if it's already a singleton instance
    if (this.singletons.has(name)) {
      return this.singletons.get(name) as T;
    }

    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not registered`);
    }

    // Handle singleton services
    if (service.singleton) {
      const instance = service.factory();
      this.singletons.set(name, instance);
      return instance as T;
    }

    // Handle regular factory services
    if (typeof service === 'function') {
      return service() as T;
    }

    throw new Error(`Invalid service registration for '${name}'`);
  }

  /**
   * Checks if a service is registered
   * @param name - Service identifier
   * @returns True if service is registered
   */
  has(name: string): boolean {
    return this.services.has(name) || this.singletons.has(name);
  }

  /**
   * Lists all registered service names
   * @returns Array of service names
   */
  listServices(): string[] {
    const serviceNames = Array.from(this.services.keys());
    const singletonNames = Array.from(this.singletons.keys());
    return [...serviceNames, ...singletonNames];
  }

  /**
   * Clears all registered services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.singletons.clear();
  }
}