import { createPXEClient, waitForPXE, type PXE } from "@aztec/aztec.js";
import { NETWORK_CONFIG } from "@/config/contracts";

/**
 * Aztec service for managing PXE connections
 * Implements singleton pattern for efficient connection management
 */
class AztecService {
  private static instance: AztecService;
  private pxeClient: PXE | null = null;
  private connectionPromise: Promise<PXE> | null = null;

  private constructor() {}

  static getInstance(): AztecService {
    if (!AztecService.instance) {
      AztecService.instance = new AztecService();
    }
    return AztecService.instance;
  }


  async getPXEClient(): Promise<PXE> {
    if (this.pxeClient) {
      return this.pxeClient;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.createConnection();

    try {
      this.pxeClient = await this.connectionPromise;
      return this.pxeClient;
    } catch (error) {
      this.connectionPromise = null;
      throw error;
    }
  }


  private async createConnection(): Promise<PXE> {
    try {
      const pxe = createPXEClient(NETWORK_CONFIG.PXE_URL);
      await waitForPXE(pxe);
      return pxe;
    } catch (error) {
      console.error("Failed to connect to PXE:", error);
      throw new Error(`Failed to connect to Aztec PXE at ${NETWORK_CONFIG.PXE_URL}`);
    }
  }


  isConnected(): boolean {
    return this.pxeClient !== null;
  }


  disconnect(): void {
    this.pxeClient = null;
    this.connectionPromise = null;
  }


  getStatus(): "connected" | "connecting" | "disconnected" {
    if (this.pxeClient) return "connected";
    if (this.connectionPromise) return "connecting";
    return "disconnected";
  }
}

export const aztecService = AztecService.getInstance();
export default aztecService;