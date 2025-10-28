"use client";

import { useState } from "react";
import { useWallet } from "@/context";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/Fallbacks";
import {
  Wallet,
  Copy,
  Check,
  LogOut,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2
} from "lucide-react";

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
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <Wallet className="w-4 h-4 text-green-500" />
        </div>

        <div className="flex items-center gap-2">
          <button
            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group"
            onClick={() => setExpandedAddress(!expandedAddress)}
            title="Click to toggle full address"
          >
            {expandedAddress ? (
              <span className="break-all">{wallet.address}</span>
            ) : (
              <span>{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
            )}
            {expandedAddress ? (
              <ChevronUp className="w-3 h-3 shrink-0" />
            ) : (
              <ChevronDown className="w-3 h-3 shrink-0" />
            )}
          </button>

          <Button
            size="sm"
            variant="ghost"
            onClick={copyAddress}
            className="h-7 w-7 p-0 hover:bg-primary/10"
            title={copied ? "Copied!" : "Copy address"}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>

          <div className="h-4 w-px bg-border" />

          <Button
            variant="ghost"
            size="sm"
            onClick={disconnectWallet}
            className="h-7 px-2 hover:bg-red-500/10 hover:text-red-500 transition-colors"
            title="Disconnect wallet"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-3 p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 shrink-0">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-red-800 dark:text-red-300">Connection Error</div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-1 break-words">{error}</div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => resetWallet()}
            className="hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            Try Again
          </Button>
          {accountStatus === 'none' && (
            <Button
              variant="default"
              size="sm"
              onClick={() => createAccount(defaultConnector)}
              disabled={isCreatingAccount}
            >
              {isCreatingAccount ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
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
        className="font-semibold bg-primary hover:bg-primary/90 group"
      >
        <Wallet className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
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
        className="font-semibold group"
      >
        <Wallet className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
        Connect Wallet
      </Button>
    );
  }

  return (
    <Button
      onClick={() => connectWallet(defaultConnector)}
      variant="default"
      size="md"
      className="font-semibold group"
    >
      <Wallet className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
      Connect Wallet
    </Button>
  );
}