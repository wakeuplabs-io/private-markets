// components/ui/ConnectAzguardButton.tsx
"use client";

import { useAzguardConnect } from "@/hooks/useAzguardConnect";
import { Button } from "@/components/ui/Button";

export default function ConnectAzguardButton() {
  const { state, connect, disconnect, reset } = useAzguardConnect();

  if (state.status === "connected") {
    const hasAccounts = state.client.accounts.length > 0;
    const primaryAccount = hasAccounts ? state.client.accounts[0] : null;

    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 backdrop-blur-sm">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
        <div className="text-sm">
          <div className="font-semibold text-foreground">Connected to Azguard</div>
          {primaryAccount && (
            <div className="text-muted-foreground text-xs">
              Address: {primaryAccount.slice(0, 8)}...{primaryAccount.slice(-6)}
            </div>
          )}
          {state.client.accounts.length > 1 && (
            <div className="text-muted-foreground text-xs">
              +{state.client.accounts.length - 1} more accounts
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={disconnect}
          className="ml-auto"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-2 p-3 rounded-lg border border-red-200 bg-red-50">
        <div className="text-sm font-semibold text-red-800">Connection Error</div>
        <div className="text-xs text-red-600">{state.error}</div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => reset()}
          className="self-start"
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={connect}
      disabled={state.status === "connecting"}
      variant="default"
      size="md"
      className="font-semibold"
    >
      {state.status === "connecting" ? "Connecting..." : "Log In"}
    </Button>
  );
}