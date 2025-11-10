"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useTokenActions } from "@/hooks/useTokenActions";

interface TokenActionsDropdownProps {
  contractAddress?: string;
  onSuccess?: (txHash: string) => void;
  className?: string;
}

/**
 * Dropdown component for token actions (mint, refresh)
 */
export default function TokenActionsDropdown({
  contractAddress,
  onSuccess,
  className
}: TokenActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    actions,
    isMinting,
    isRefreshing,
    mintError,
    balanceError,
    lastTxHash,
    clearErrors,
  } = useTokenActions(contractAddress);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.right - 320,
      });
    }
  }, [isOpen]);

  const handleMintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!recipient.trim() || !amount.trim()) {
      return;
    }

    try {
      const recipientAddress = AztecAddress.fromString(recipient.trim());
      const amountBigInt = BigInt(amount);

      const txHash = await actions.mintToPrivate(recipientAddress, amountBigInt * BigInt(10) ** BigInt(18));

      // Clear form
      setRecipient("");
      setAmount("");
      setIsOpen(false);

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

              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">Mint to Private</h4>

                <form onSubmit={handleMintSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Recipient Address
                    </label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                      disabled={isMinting}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="100"
                      min="1"
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                      disabled={isMinting}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={isMinting || !recipient.trim() || !amount.trim()}
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

              {lastTxHash && (
                <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                  Transaction successful: {lastTxHash.slice(0, 10)}...
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