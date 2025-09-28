/**
 * @fileoverview Blockchain service interface
 * Defines the contract for blockchain interaction services
 *
 * @module domain/services/IBlockchainService
 */

/**
 * Interface for blockchain interaction services
 */
export interface IBlockchainService {
  /**
   * Starts listening for blockchain events
   * @returns Promise that resolves when listener is active
   */
  startListening(): Promise<void>;

  /**
   * Stops listening for blockchain events
   * @returns Promise that resolves when listener is stopped
   */
  stopListening(): Promise<void>;

  /**
   * Gets the current block number
   * @returns Promise resolving to current block number
   */
  getCurrentBlock(): Promise<number>;

  /**
   * Checks if the service is currently listening
   * @returns True if listener is active
   */
  isListening(): boolean;

  /**
   * Gets connection status information
   * @returns Connection status details
   */
  getConnectionStatus(): {
    connected: boolean;
    rpcUrl: string;
    chainId: number;
    contractAddress: string;
  };
}