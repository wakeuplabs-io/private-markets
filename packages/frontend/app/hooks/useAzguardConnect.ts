// hooks/useAzguardConnect.ts
"use client";

import { useCallback, useMemo, useState } from "react";
import { createPXEClient, waitForPXE, type PXE } from "@aztec/aztec.js";
import { createAzguardClient, connectToAzguard, isAzguardAvailable, type ConnectResult } from "@/lib/azguard";
import type { AzguardClient } from "@azguardwallet/client";
type State =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; client: AzguardClient; pxe?: PXE }
  | { status: "error"; error: string };

export function useAzguardConnect() {
  const [state, setState] = useState<State>({ status: "idle" });

  const connect = useCallback(async (): Promise<ConnectResult | null> => {
    try {
      setState({ status: "connecting" });

      // Check if Azguard is available
      if (!(await isAzguardAvailable())) {
        throw new Error(
          "Azguard Wallet no está instalado. Por favor instala Azguard Wallet y recarga la página."
        );
      }

      // Create Azguard client
      const client = await createAzguardClient();
      if (!client) {
        throw new Error("No se pudo crear el cliente de Azguard Wallet.");
      }

      // Connect to Azguard with dApp metadata
      const connection = await connectToAzguard(client);
      if (!connection) {
        throw new Error("Falló la conexión con Azguard Wallet.");
      }

      // Check if client is connected
      if (!connection.client.connected) {
        throw new Error("Azguard Wallet no se conectó correctamente.");
      }

      // Optional: Create PXE client for direct Aztec interactions
      let pxe: PXE | undefined;
      try {
        const pxeUrl = process.env.NEXT_PUBLIC_PXE_URL ?? "http://localhost:8080";
        pxe = createPXEClient(pxeUrl);
        await waitForPXE(pxe);
      } catch (pxeError) {
        console.warn("PXE connection failed, continuing without direct PXE:", pxeError);
        // Don't fail the connection if PXE is not available
      }

      setState({
        status: "connected",
        client: connection.client,
        pxe
      });

      return {
        client: connection.client,
        pxe
      };
    } catch (e: unknown) {
      setState({ status: "error", error: String((e as Error)?.message ?? e) });
      return null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      if (state.status === "connected") {
        // Note: Official client might not have disconnect method yet
        // For now, we'll just reset the state
        console.log("Disconnecting from Azguard...");
      }
    } catch (error) {
      console.error("Error during disconnect:", error);
    } finally {
      setState({ status: "idle" });
    }
  }, [state]);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  const connected = useMemo(() => state.status === "connected", [state.status]);

  return {
    state,
    connected,
    connect,
    disconnect,
    reset
  };
}