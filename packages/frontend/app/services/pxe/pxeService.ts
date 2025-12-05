import type { PXE } from '@aztec/pxe/client/lazy';
import type { AztecNode } from '@aztec/aztec.js/node';

/**
 * PXE Service Singleton
 *
 * Provides global access to the PXE and AztecNode instances created by AztecWalletProvider.
 * This allows other services (like TokenProvider, VaultProvider)
 * to access the PXE and AztecNode without tight coupling.
 *
 * Usage:
 * 1. AztecWalletProvider registers the PXE and AztecNode after initialization
 * 2. Other services can get them using pxeService.getPXE() and pxeService.getAztecNode()
 */
export class PXEService {
  private static instance: PXEService;
  private pxe: PXE | null = null;
  private aztecNode: AztecNode | null = null;

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
   * @param aztecNode - The AztecNode instance to register (optional)
   */
  async registerPXE(pxe: PXE, aztecNode?: AztecNode): Promise<void> {
    this.pxe = pxe;
    if (aztecNode) {
      this.aztecNode = aztecNode;
    }
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
   * Get the registered AztecNode instance
   *
   * @returns The AztecNode instance
   * @throws Error if AztecNode is not initialized
   */
  getAztecNode(): AztecNode {
    if (!this.aztecNode) {
      throw new Error(
        'AztecNode not initialized. Make sure AztecWalletProvider.initialize() has been called and completed.'
      );
    }
    return this.aztecNode;
  }

  /**
   * Check if AztecNode is initialized
   *
   * @returns true if AztecNode is registered, false otherwise
   */
  isAztecNodeInitialized(): boolean {
    return this.aztecNode !== null;
  }

  /**
   * Clear the registered PXE
   * Useful for testing or when disconnecting
   */
  clearPXE(): void {
    this.pxe = null;
    this.aztecNode = null;
    console.log('[PXEService] PXE cleared');
  }
}

/**
 * Singleton instance export
 */
export const pxeService = PXEService.getInstance();
