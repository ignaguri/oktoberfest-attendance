"use client";

import { IS_PROD } from "@prostcounter/shared/constants";
import { ApiClientProvider } from "@prostcounter/shared/data";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { type ReactNode, useState } from "react";

import { apiClient } from "@/lib/api-client";

/**
 * Create a QueryClient with optimized settings for ProstCounter
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default stale time - data is fresh for 2 minutes (reduced for better freshness)
        staleTime: 2 * 60 * 1000,
        // Default cache time - data stays in cache for 10 minutes
        gcTime: 10 * 60 * 1000,
        // Retry failed queries 2 times
        retry: 2,
        // Don't refetch on window focus by default (can be overridden per query)
        refetchOnWindowFocus: false,
        // Refetch when reconnecting to internet
        refetchOnReconnect: true,
        // Refetch when component mounts if data is stale
        refetchOnMount: true,
      },
      mutations: {
        // Retry failed mutations once
        retry: 1,
      },
    },
  });
}

interface DataProviderProps {
  children: ReactNode;
}

/**
 * Provider component that sets up React Query for the entire app
 * This should be placed high in the component tree, ideally in the root layout
 */
export function DataProvider({ children }: DataProviderProps) {
  // Create a stable QueryClient instance
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>
      {/* Only show DevTools in development */}
      {!IS_PROD && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

/**
 * Hook to get the current QueryClient instance
 * Useful for advanced operations outside of hooks
 */
export { useQueryClient } from "@tanstack/react-query";
