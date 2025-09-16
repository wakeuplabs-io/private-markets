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

      if (!(await isAzguardAvailable())) {
        throw new Error(
          "Azguard Wallet no está instalado. Por favor instala Azguard Wallet y recarga la página."
        );
      }

      const client = await createAzguardClient();
      if (!client) {
        throw new Error("Could not create Azguard Wallet client.");
      }

      const connection = await connectToAzguard(client);
      if (!connection) {
        throw new Error("Connection failed.");
      }

      if (!connection.client.connected) {
        throw new Error("Azguard Wallet did not connect correctly.");
      }

      let pxe: PXE | undefined;
      try {
        const pxeUrl = process.env.NEXT_PUBLIC_PXE_URL ?? "http://localhost:8080";
        pxe = createPXEClient(pxeUrl);
        await waitForPXE(pxe);
      } catch (pxeError) {
        console.warn("PXE connection failed, continuing without direct PXE:", pxeError);
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