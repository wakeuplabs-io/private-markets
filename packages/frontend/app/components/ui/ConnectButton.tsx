"use client";

import { useWallet } from "@/context";
import { Button } from "@/components/ui/Button";

export default function ConnectButton() {
  const { status, wallet, error, connectWallet, disconnectWallet, resetWallet, isConnecting, isConnected } = useWallet();

  if (isConnected && wallet) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 backdrop-blur-sm">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
        <div className="text-sm">
          <div className="font-semibold text-foreground">Connected via {wallet.connector}</div>
          <div className="text-muted-foreground text-xs">
            Address: {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={disconnectWallet}
          className="ml-auto"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-2 p-3 rounded-lg border border-red-200 bg-red-50">
        <div className="text-sm font-semibold text-red-800">Connection Error</div>
        <div className="text-xs text-red-600">{error}</div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => resetWallet()}
          className="self-start"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => connectWallet('obsidion')}
      disabled={isConnecting}
      variant="default"
      size="md"
      className="font-semibold"
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </Button>
  );
}