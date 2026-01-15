"use client";

import { cn } from "@/lib/utils";
import { Beer, Citrus } from "lucide-react";

interface RadlerIconProps {
  className?: string;
}

/**
 * Composite icon for Radler (beer + citrus)
 * Beer with citrus garnish in top-right corner
 */
export function RadlerIcon({ className }: RadlerIconProps) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
    >
      {/* Main Beer Glass */}
      <Beer className="h-5 w-5" />

      {/* Citrus Garnish - Positioned Top Right */}
      <span className="absolute -right-1 -top-1 rounded-full bg-white p-[1px]">
        <Citrus className="h-3 w-3" />
      </span>
    </span>
  );
}

RadlerIcon.displayName = "RadlerIcon";
