"use client";

/**
 * API Client Context
 *
 * Provides platform-specific API client to shared hooks via React Context.
 * Web and mobile apps wrap their app with ApiClientProvider, passing their
 * configured apiClient instance.
 *
 * Note: We use a generic ApiClient type here to avoid cyclic dependencies
 * between @prostcounter/shared and @prostcounter/api-client.
 */

import { createContext, useContext, type ReactNode } from "react";

/**
 * Generic API client interface that matches the structure of TypedApiClient
 * from @prostcounter/api-client. This avoids importing from api-client
 * which would create a cyclic dependency.
 */

export type ApiClient = any;

const ApiClientContext = createContext<ApiClient | null>(null);

export interface ApiClientProviderProps {
  client: ApiClient;
  children: ReactNode;
}

/**
 * Provider component that makes the API client available to shared hooks
 */
export function ApiClientProvider({
  client,
  children,
}: ApiClientProviderProps) {
  return (
    <ApiClientContext.Provider value={client}>
      {children}
    </ApiClientContext.Provider>
  );
}

/**
 * Hook to access the API client from shared hooks
 * @throws Error if used outside of ApiClientProvider
 */
export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) {
    throw new Error("useApiClient must be used within an ApiClientProvider");
  }
  return client;
}
