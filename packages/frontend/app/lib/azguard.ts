import { AzguardClient } from "@azguardwallet/client";
import type { PXE } from "@aztec/aztec.js";
import type { DappPermissions } from "@azguardwallet/types";

export type ConnectResult = {
  client: AzguardClient;
  pxe?: PXE;
};

export type AzguardConnection = {
  client: AzguardClient;
};


export async function isAzguardAvailable(): Promise<boolean> {
  return await AzguardClient.isAzguardInstalled();
}

export async function createAzguardClient(): Promise<AzguardClient | null> {
  try {
    if (!(await isAzguardAvailable())) {
      return null;
    }
    const client = await AzguardClient.create();
    return client;
  } catch (error) {
    console.error("Failed to create Azguard client:", error);
    return null;
  }
}


export async function connectToAzguard(client: AzguardClient): Promise<AzguardConnection | null> {
    const dappMetadata = {
      name: "Private Markets",
      description: "Prediction Markets on Aztec",
      url: "http://localhost:3000",
      icon: "http://localhost:3000/favicon.ico"
    };
    const permissions: DappPermissions[] = [
      {
        // "aztec:11155111" - testnet,
        // "aztec:1337" - devnet,
        // "aztec:31337" - sandbox
        chains: ["aztec:31337"],
        methods: ["send_transaction", "add_private_authwit", "call"],
      },
    ]


    try {
      await client.connect(dappMetadata, permissions);
      return {
        client,
      };


  } catch (error) {
    console.error("Failed to connect to Azguard:", error);
    return null;
  }
}