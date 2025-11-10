import { walletRegistry } from "@/lib/wallet";
import { AztecWalletProvider } from "@/providers/aztec/aztecWalletProvider";
import type { AztecWalletConfig } from "@/providers/aztec/types";

export function createAztecProvider(config: AztecWalletConfig = {}): AztecWalletProvider {
  return new AztecWalletProvider(config);
}

export function registerAztecProvider(config: AztecWalletConfig = {}): void {
  const provider = createAztecProvider(config);
  walletRegistry.register("aztec", provider);
}

export function getDefaultAztecConfig(): AztecWalletConfig {
  return {
    nodeUrl: process.env.NEXT_PUBLIC_PXE_URL || "http://localhost:8080",
    proverEnabled: true,
    accountType: "schnorr",
  };
}