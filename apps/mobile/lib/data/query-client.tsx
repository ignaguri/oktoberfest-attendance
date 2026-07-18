import { ApiError, AuthRequiredError } from "@prostcounter/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

const MAX_RETRIES = 2;

/** 4xx and AuthRequiredError are deterministic — never retry them. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof AuthRequiredError) return false;
  if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

/**
 * Mutations retry ONLY on true no-response errors. Any ApiError means the
 * server received and processed the request; re-sending a non-idempotent
 * mutation risks duplicates.
 */
export function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) return false;
  if (error instanceof AuthRequiredError) return false;
  return failureCount < MAX_RETRIES;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "always", // Don't pause queries when offline - fail fast so UI shows error/cached state
        staleTime: 2 * 60 * 1000, // 2 minutes (reduced for better freshness)
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: true, // Refetch stale data when component mounts
      },
      mutations: {
        retry: shouldRetryMutation,
      },
    },
  });
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
