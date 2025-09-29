"use client";

import { useState } from "react";
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

  const [expandedAddress, setExpandedAddress] = useState(false);
  const [copied, setCopied] = useState(false);

  const defaultConnector = 'aztec';

  const copyAddress = async () => {
    if (!wallet?.address) return;

    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };
  if (isConnected && wallet) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 backdrop-blur-sm">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
        <div className="text-sm flex-1">
          <div className="font-semibold text-foreground">Connected via {wallet.connector}</div>
          <div className="space-y-1">
            <div
              className="text-muted-foreground text-xs cursor-pointer hover:text-foreground transition-colors"
              onClick={() => setExpandedAddress(!expandedAddress)}
            >
              {expandedAddress ? 'Address:' : `Address: ${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`}
              {!expandedAddress && <span className="text-primary ml-1">(click to expand)</span>}
            </div>

            {expandedAddress && (
              <div className="flex items-center gap-2 mt-2">
                <div className="font-mono text-xs bg-secondary/50 p-2 rounded border flex-1 break-all">
                  {wallet.address}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyAddress}
                  className="shrink-0 h-8 w-8 p-0"
                  title={copied ? "Copied!" : "Copy address"}
                >
                  {copied ? '✓' : '📋'}
                </Button>
              </div>
            )}
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