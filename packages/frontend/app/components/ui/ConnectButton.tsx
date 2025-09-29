"use client";

import { useWallet } from "@/context";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/Fallbacks";

export default function ConnectButton() {
  const {
    status,
    accountStatus,
    wallet,
    error,
    connectWallet,
    createAccount,
    disconnectWallet,
    resetWallet,
    isConnecting,
    isConnected,
    isCheckingAccount,
    isCreatingAccount
  } = useWallet();

  const defaultConnector = 'aztec';
  if (isConnected && wallet) {
    console.log("wallet.address", wallet.address);

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
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => resetWallet()}
            className="self-start"
          >
            Try Again
          </Button>
          {accountStatus === 'none' && (
            <Button
              variant="default"
              size="sm"
              onClick={() => createAccount(defaultConnector)}
              disabled={isCreatingAccount}
              className="self-start"
            >
              {isCreatingAccount ? "Creating..." : "Create Account"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (isCheckingAccount) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 backdrop-blur-sm">
        <LoadingState
          message="Checking account status..."
          variant="minimal"
          className="justify-center"
        />
      </div>
    );
  }

  if (isCreatingAccount) {
    return (
      <Button
        disabled
        variant="default"
        size="md"
        className="font-semibold"
      >
        <LoadingState
          message="Creating account..."
          variant="minimal"
          className="justify-center"
        />
      </Button>
    );
  }

  if (isConnecting) {
    return (
      <Button
        disabled
        variant="default"
        size="md"
        className="font-semibold"
      >
        <LoadingState
          message="Connecting..."
          variant="minimal"
          className="justify-center"
        />
      </Button>
    );
  }

  if (accountStatus === 'none') {
    return (
      <Button
        onClick={() => createAccount(defaultConnector)}
        variant="default"
        size="md"
        className="font-semibold bg-primary hover:bg-primary/90"
      >
        Create Account
      </Button>
    );
  }

  if (accountStatus === 'exists') {
    return (
      <Button
        onClick={() => connectWallet(defaultConnector)}
        variant="default"
        size="md"
        className="font-semibold"
      >
        Connect Wallet
      </Button>
    );
  }

  return (
    <Button
      onClick={() => connectWallet(defaultConnector)}
      variant="default"
      size="md"
      className="font-semibold"
    >
      Connect Wallet
    </Button>
  );
}