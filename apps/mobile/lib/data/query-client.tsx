import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "always", // Don't pause queries when offline - fail fast so UI shows error/cached state
        staleTime: 2 * 60 * 1000, // 2 minutes (reduced for better freshness)
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: 2,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: true, // Refetch stale data when component mounts
      },
      mutations: {
        retry: 1,
      },
    },
  });
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
