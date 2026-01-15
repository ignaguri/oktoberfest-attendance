"use client";

import { webFestivalStorage } from "@/lib/festival-storage";
import { FestivalProvider } from "@prostcounter/shared/contexts";

import type { ReactNode } from "react";

interface WebFestivalProviderProps {
  children: ReactNode;
}

/**
 * Web-specific FestivalProvider wrapper
 * This client component wraps the shared FestivalProvider with localStorage storage
 */
export function WebFestivalProvider({ children }: WebFestivalProviderProps) {
  return (
    <FestivalProvider storage={webFestivalStorage}>{children}</FestivalProvider>
  );
}
