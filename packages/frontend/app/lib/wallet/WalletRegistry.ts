import type { IWalletProvider } from "@/types/wallet";

/**
 * Registry for managing wallet providers
 * Handles registration, retrieval, and lifecycle of wallet providers
 */
export class WalletRegistry {
  private providers = new Map<string, IWalletProvider>();
  private static instance: WalletRegistry;

  private constructor() {}

  static getInstance(): WalletRegistry {
    if (!WalletRegistry.instance) {
      WalletRegistry.instance = new WalletRegistry();
    }
    return WalletRegistry.instance;
  }

  /**
   * Register a wallet provider
   * @param name - Unique identifier for the provider
   * @param provider - The wallet provider instance
   */
  register(name: string, provider: IWalletProvider): void {
    if (this.providers.has(name)) {
      console.warn(`Wallet provider "${name}" is already registered. Overriding...`);
    }
    this.providers.set(name, provider);
  }

  /**
   * Get a wallet provider by name
   * @param name - The provider identifier
   * @returns The provider instance or undefined if not found
   */
  get(name: string): IWalletProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all available provider names
   * @returns Array of registered provider names
   */
  getAvailable(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is registered
   * @param name - The provider identifier
   * @returns True if the provider is registered
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Unregister a wallet provider
   * @param name - The provider identifier to remove
   * @returns True if the provider was removed, false if it wasn't found
   */
  unregister(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers.clear();
  }

  /**
   * Get the count of registered providers
   * @returns Number of registered providers
   */
  size(): number {
    return this.providers.size;
  }
}

// Singleton instance
export const walletRegistry = WalletRegistry.getInstance();