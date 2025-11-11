'use client';

import React from 'react';

interface LoadingStep {
  label: string;
  delay?: string;
}

interface PXELoadingModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  steps?: LoadingStep[];
}

export function PXELoadingModal({
  isOpen,
  title,
  description,
  steps = [],
}: PXELoadingModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg p-8 w-full max-w-md mx-4 text-center min-h-[320px] flex flex-col justify-center">
        <div className="mb-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">{description}</p>
        <div className="min-h-[80px]">
          {steps.length > 0 && (
            <div className="space-y-2 text-xs text-muted-foreground text-left">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 bg-primary rounded-full animate-pulse ${step.delay || ''}`}
                  ></div>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

