import type { PXE } from '@aztec/pxe/client/lazy';

/**
 * PXE Service Singleton
 *
 * Provides global access to the PXE instance created by AztecWalletProvider.
 * This allows other services (like TokenProvider, VaultProvider)
 * to access the PXE without tight coupling.
 *
 * Usage:
 * 1. AztecWalletProvider registers the PXE after initialization
 * 2. Other services can get the PXE using pxeService.getPXE()
 */
export class PXEService {
  private static instance: PXEService;
  private pxe: PXE | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): PXEService {
    if (!PXEService.instance) {
      PXEService.instance = new PXEService();
    }
    return PXEService.instance;
  }

  /**
   * Register the PXE instance
   * Should be called by AztecWalletProvider after PXE initialization
   *
   * @param pxe - The PXE instance to register
   */
  async registerPXE(pxe: PXE): Promise<void> {
    this.pxe = pxe;
    console.log('[PXEService] PXE registered successfully');
  }

  /**
   * Get the registered PXE instance
   *
   * @returns The PXE instance
   * @throws Error if PXE is not initialized
   */
  getPXE(): PXE {
    if (!this.pxe) {
      throw new Error(
        'PXE not initialized. Make sure AztecWalletProvider.initialize() has been called and completed.'
      );
    }
    return this.pxe;
  }

  /**
   * Check if PXE is initialized
   *
   * @returns true if PXE is registered, false otherwise
   */
  isInitialized(): boolean {
    return this.pxe !== null;
  }

  /**
   * Clear the registered PXE
   * Useful for testing or when disconnecting
   */
  clearPXE(): void {
    this.pxe = null;
    console.log('[PXEService] PXE cleared');
  }
}

/**
 * Singleton instance export
 */
export const pxeService = PXEService.getInstance();
