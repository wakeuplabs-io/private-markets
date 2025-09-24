import { createPXEClient, waitForPXE, type PXE, Wallet } from "@aztec/aztec.js";
import { NETWORK_CONFIG } from "@/config/contracts";

// Types for better error handling
export type AztecConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

export interface AztecConnectionError {
  type: "network" | "timeout" | "configuration" | "unknown";
  message: string;
  details?: string;
  recoverable: boolean;
}

/**
 * Aztec service for managing PXE connections
 * Implements singleton pattern for efficient connection management
 * Provides graceful error handling without crashing the application
 */
class AztecService {
  private static instance: AztecService;
  private pxeClient: PXE | null = null;
  private connectionPromise: Promise<PXE> | null = null;
  private connectedWallet: Wallet | null = null;
  private lastError: AztecConnectionError | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 2000; // 2 seconds

  private constructor() {}

  static getInstance(): AztecService {
    if (!AztecService.instance) {
      AztecService.instance = new AztecService();
    }
    return AztecService.instance;
  }


  /**
   * Gets PXE client with graceful error handling
   * Returns null instead of throwing if connection fails
   */
  async getPXEClient(): Promise<PXE | null> {
    try {
      if (this.pxeClient) {
        return this.pxeClient;
      }

      if (this.connectionPromise) {
        return await this.connectionPromise;
      }

      this.connectionPromise = this.createConnection();
      this.pxeClient = await this.connectionPromise;
      
      // Reset error state on successful connection
      this.lastError = null;
      this.retryCount = 0;
      
      return this.pxeClient;
    } catch (error) {
      this.connectionPromise = null;
      this.pxeClient = null;
      this.handleConnectionError(error);
      return null;
    }
  }

  /**
   * Gets PXE client but throws if not available (for critical operations)
   */
  async getPXEClientOrThrow(): Promise<PXE> {
    const client = await this.getPXEClient();
    if (!client) {
      throw new Error(this.getConnectionErrorMessage());
    }
    return client;
  }


  private async createConnection(): Promise<PXE> {
    const timeoutMs = 10000; // 10 seconds timeout
    
    try {
      console.log(`[AztecService] Connecting to PXE at ${NETWORK_CONFIG.PXE_URL}...`);
      
      const pxe = createPXEClient(NETWORK_CONFIG.PXE_URL);
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Connection timeout after ${timeoutMs/1000} seconds`));
        }, timeoutMs);
      });
      
      // Race between connection and timeout
      await Promise.race([
        waitForPXE(pxe),
        timeoutPromise
      ]);
      
      console.log(`[AztecService] Successfully connected to PXE`);
      return pxe;
    } catch (error) {
      console.error("[AztecService] Failed to connect to PXE:", error);
      throw error;
    }
  }

  private handleConnectionError(error: unknown): void {
    console.error("[AztecService] Connection error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Categorize error types
    let errorType: AztecConnectionError["type"] = "unknown";
    let recoverable = true;
    let userMessage = "No se pudo conectar con la blockchain de Aztec";
    
    if (errorMessage.includes("timeout")) {
      errorType = "timeout";
      userMessage = "Timeout connecting to Aztec. Verify your internet connection.";
    } else if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch")) {
      errorType = "network";
      userMessage = "Cannot reach the Aztec server. Verify that the node is running.";
    } else if (errorMessage.includes("configuration") || errorMessage.includes("config")) {
      errorType = "configuration";
      userMessage = "Aztec configuration error. Verify the environment variables.";
      recoverable = false;
    }
    
    this.lastError = {
      type: errorType,
      message: userMessage,
      details: errorMessage,
      recoverable
    };
    
    this.retryCount++;
  }

  private getConnectionErrorMessage(): string {
    if (this.lastError) {
      return this.lastError.message;
    }
    return "Could not establish connection with the Aztec blockchain";
  }


  isConnected(): boolean {
    return this.pxeClient !== null;
  }

  disconnect(): void {
    console.log("[AztecService] Disconnecting from PXE");
    this.pxeClient = null;
    this.connectionPromise = null;
    this.lastError = null;
    this.retryCount = 0;
  }

  getStatus(): AztecConnectionStatus {
    if (this.lastError) return "error";
    if (this.pxeClient) return "connected";
    if (this.connectionPromise) return "connecting";
    return "disconnected";
  }

  getLastError(): AztecConnectionError | null {
    return this.lastError;
  }

  getUserFriendlyErrorMessage(): string {
    return this.getConnectionErrorMessage();
  }

  canRetry(): boolean {
    return this.retryCount < this.maxRetries && 
           (this.lastError?.recoverable ?? true);
  }

  async retry(): Promise<PXE | null> {
    if (!this.canRetry()) {
      console.warn("[AztecService] Max retries reached or error not recoverable");
      return null;
    }

    console.log(`[AztecService] Retrying connection (attempt ${this.retryCount + 1}/${this.maxRetries})`);
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
    
    return this.getPXEClient();
  }

  clearError(): void {
    this.lastError = null;
    this.retryCount = 0;
  }

  getConnectedWallet(): Wallet | null {
    return this.connectedWallet;
  }

  setConnectedWallet(wallet: Wallet | null): void {
    this.connectedWallet = wallet;
  }

  clearConnectedWallet(): void {
    this.connectedWallet = null;
  }

  /**
   * Checks if Aztec service is available for operations
   */
  async isAvailable(): Promise<boolean> {
    const client = await this.getPXEClient();
    return client !== null;
  }

  /**
   * Gets connection health information
   */
  getHealthInfo(): {
    status: AztecConnectionStatus;
    isConnected: boolean;
    error: AztecConnectionError | null;
    canRetry: boolean;
    retryCount: number;
    maxRetries: number;
  } {
    return {
      status: this.getStatus(),
      isConnected: this.isConnected(),
      error: this.lastError,
      canRetry: this.canRetry(),
      retryCount: this.retryCount,
      maxRetries: this.maxRetries
    };
  }
}

export const aztecService = AztecService.getInstance();
export default aztecService;