import React from "react";
import { cn } from "@/lib/utils";

interface ReadOnlyOverlayProps {
  active?: boolean;
  message?: string;
  className?: string;
  children: React.ReactNode;
}

export function ReadOnlyOverlay({ active = false, message, className, children }: ReadOnlyOverlayProps) {
  if (!active) return <>{children}</>;

  return (
    <div className={cn("relative", className)}>
      <div className="opacity-60 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 cursor-not-allowed" aria-hidden="true" />
      {message && (
        <div className="mt-2 rounded-md border border-border/50 bg-surface-secondary px-3 py-2 text-sm text-text-secondary">
          {message}
        </div>
      )}
    </div>
  );
}
