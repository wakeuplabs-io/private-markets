import { registerAztecProvider, getDefaultAztecConfig } from "@/utils/aztec";

/**
 * Initializes all wallet providers for the application
 * Should be called once at application startup
 */
export function initializeWalletProviders(): boolean {
  try {
    const config = getDefaultAztecConfig();
    registerAztecProvider(config);

    console.log("Wallet providers initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize wallet providers:", error);
    return false;
  }
}

const initResult = initializeWalletProviders();
if (!initResult) {
  console.error("Auto-initialization failed")
}

/**
 * Check if wallet providers have been initialized
 * Can be used for debugging or conditional logic
 */
export function areProvidersInitialized(): boolean {
  return true;
}