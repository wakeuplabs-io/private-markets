"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useTokenActions } from "@/hooks/useTokenActions";
import { useEVMTokenActions } from "@/hooks/useEVMTokenActions";
import { useWallet } from "@/context";

interface TokenActionsDropdownProps {
  contractAddress?: string;
  evmTokenAddress?: `0x${string}`;
  onSuccess?: (txHash: string) => void;
  className?: string;
}

/**
 * Dropdown component for token actions (mint, refresh)
 */
export default function TokenActionsDropdown({
  contractAddress,
  evmTokenAddress,
  onSuccess,
  className
}: TokenActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [isEditingAztecRecipient, setIsEditingAztecRecipient] = useState(false);
  const [amount, setAmount] = useState("1000");
  const [evmRecipient, setEvmRecipient] = useState("");
  const [isEditingEvmRecipient, setIsEditingEvmRecipient] = useState(false);
  const [evmAmount, setEvmAmount] = useState("1000");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [successMessage, setSuccessMessage] = useState<{ type: 'aztec' | 'evm'; txHash: string } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Get connected wallets
  const { wallet: aztecWallet } = useWallet();

  const {
    actions,
    isMinting,
    isRefreshing,
    mintError,
    balanceError,
    lastTxHash,
    clearErrors,
  } = useTokenActions(contractAddress);

  const {
    mint: evmMint,
    isMinting: isEvmMinting,
    mintError: evmMintError,
    clearErrors: clearEvmErrors,
    isConnected: isEvmConnected,
    userAddress: evmUserAddress,
    hasTokenAddress: hasEvmTokenAddress,
  } = useEVMTokenActions(evmTokenAddress);

  // Get effective addresses (custom or connected wallet)
  const effectiveAztecRecipient = recipient || aztecWallet?.address || "";
  const effectiveEvmRecipient = evmRecipient || evmUserAddress || "";

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.right - 320,
      });
    }
  }, [isOpen]);

  // Auto-close dropdown after successful transaction
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setIsOpen(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleMintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!effectiveAztecRecipient.trim() || !amount.trim()) {
      return;
    }

    try {
      const recipientAddress = AztecAddress.fromString(effectiveAztecRecipient.trim());
      const amountBigInt = BigInt(amount);

      const txHash = await actions.mintToPrivate(recipientAddress, amountBigInt * BigInt(10) ** BigInt(18));

      // Clear custom recipient if set
      setRecipient("");
      setIsEditingAztecRecipient(false);

      // Show success message with timeout
      setSuccessMessage({ type: 'aztec', txHash });

      if (onSuccess) {
        onSuccess(txHash);
      }
    } catch (error) {
      console.error("Mint failed:", error);
    }
  };

  const handleRefreshBalance = async () => {
    clearErrors();

    try {
      await actions.refreshBalance();
      setIsOpen(false);
    } catch (error) {
      console.error("Refresh failed:", error);
    }
  };

  const handleEvmMint = async (e: React.FormEvent) => {
    e.preventDefault();
    clearEvmErrors();

    if (!effectiveEvmRecipient.trim() || !evmAmount.trim()) return;

    try {
      const recipientAddr = effectiveEvmRecipient.trim() as `0x${string}`;
      const amountBigInt = BigInt(evmAmount) * BigInt(10) ** BigInt(18);
      const txHash = await evmMint(recipientAddr, amountBigInt);

      setEvmRecipient("");
      setIsEditingEvmRecipient(false);

      // Show success message with timeout
      setSuccessMessage({ type: 'evm', txHash });

      onSuccess?.(txHash);
    } catch (error) {
      console.error("EVM Mint failed:", error);
    }
  };

  return (
    <>
      <div className={cn("relative", className)}>
        <Button
          ref={buttonRef}
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 w-8 p-0"
          disabled={isMinting || isRefreshing}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </Button>
      </div>

      {isOpen && typeof window !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div
            className="fixed w-80 p-4 bg-card border border-border rounded-lg shadow-lg z-[9999]"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
            }}
          >
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Token Actions</h3>

              {/* Aztec Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-primary">Aztec</h4>

                <form onSubmit={handleMintSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Recipient Address
                    </label>
                    {isEditingAztecRecipient ? (
                      <input
                        type="text"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder="0x..."
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                        disabled={isMinting}
                        autoFocus
                        onBlur={() => {
                          if (!recipient.trim()) setIsEditingAztecRecipient(false);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditingAztecRecipient(true)}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-left hover:border-primary/50 transition-colors"
                        disabled={isMinting}
                      >
                        {effectiveAztecRecipient ? (
                          <span className="text-foreground font-mono text-xs">
                            {effectiveAztecRecipient.slice(0, 10)}...{effectiveAztecRecipient.slice(-8)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Connect wallet or click to enter</span>
                        )}
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="1000"
                      min="1"
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                      disabled={isMinting}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={isMinting || !effectiveAztecRecipient.trim() || !amount.trim()}
                    className="w-full"
                  >
                    {isMinting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                        Minting...
                      </span>
                    ) : (
                      "Mint Tokens"
                    )}
                  </Button>
                </form>

                {mintError && (
                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                    {mintError}
                  </div>
                )}
              </div>

              <div className="border-t border-border" />

              <div className="space-y-2">
                <Button
                  size="sm"
                  onClick={handleRefreshBalance}
                  disabled={isRefreshing}
                  className="w-full"
                >
                  {isRefreshing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      Refreshing...
                    </span>
                  ) : (
                    "Refresh Balance"
                  )}
                </Button>

                {balanceError && (
                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                    {balanceError}
                  </div>
                )}
              </div>

              {/* EVM Section */}
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-medium text-primary mb-3">EVM (Arbitrum)</h4>

                {!hasEvmTokenAddress ? (
                  <p className="text-xs text-muted-foreground">EVM token not configured</p>
                ) : !isEvmConnected ? (
                  <p className="text-xs text-muted-foreground">Connect EVM wallet to mint</p>
                ) : (
                  <form onSubmit={handleEvmMint} className="space-y-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Recipient Address
                      </label>
                      {isEditingEvmRecipient ? (
                        <input
                          type="text"
                          value={evmRecipient}
                          onChange={(e) => setEvmRecipient(e.target.value)}
                          placeholder="0x..."
                          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                          disabled={isEvmMinting}
                          autoFocus
                          onBlur={() => {
                            if (!evmRecipient.trim()) setIsEditingEvmRecipient(false);
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsEditingEvmRecipient(true)}
                          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-left hover:border-primary/50 transition-colors"
                          disabled={isEvmMinting}
                        >
                          {effectiveEvmRecipient ? (
                            <span className="text-foreground font-mono text-xs">
                              {effectiveEvmRecipient.slice(0, 10)}...{effectiveEvmRecipient.slice(-8)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Click to enter address</span>
                          )}
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Amount
                      </label>
                      <input
                        type="number"
                        value={evmAmount}
                        onChange={(e) => setEvmAmount(e.target.value)}
                        placeholder="1000"
                        min="1"
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                        disabled={isEvmMinting}
                      />
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={isEvmMinting || !effectiveEvmRecipient.trim() || !evmAmount.trim()}
                      className="w-full"
                    >
                      {isEvmMinting ? (
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          Minting...
                        </span>
                      ) : (
                        "Mint EVM Tokens"
                      )}
                    </Button>
                  </form>
                )}

                {evmMintError && (
                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded mt-2">
                    {evmMintError}
                  </div>
                )}
              </div>

              {successMessage && (
                <div className="text-xs text-green-600 bg-green-500/10 border border-green-500/30 p-3 rounded-md">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <p className="font-medium text-green-600">
                        {successMessage.type === 'aztec' ? 'Aztec' : 'EVM'} mint successful!
                      </p>
                      <p className="text-green-500/80 font-mono mt-0.5">
                        {successMessage.txHash.slice(0, 14)}...{successMessage.txHash.slice(-8)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 h-1 bg-green-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full animate-shrink" />
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}