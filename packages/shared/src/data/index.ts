"use client";

/**
 * Shared data layer exports
 *
 * Provider-agnostic interfaces and utilities for data fetching/caching
 * Used by both web (Next.js) and mobile (Expo) apps
 */

export { QueryKeys } from "./query-keys";
export type {
  DataQueryResult,
  DataMutationResult,
  DataQueryOptions,
  DataMutationOptions,
  DataProvider,
} from "./types";

// React Query provider implementation
export {
  useQuery,
  useMutation,
  useDataProvider,
  useInvalidateQueries,
  useSetQueryData,
  useGetQueryData,
} from "./react-query-provider";

// API Client context for shared hooks
export { ApiClientProvider, useApiClient } from "./api-client-context";
export type { ApiClientProviderProps } from "./api-client-context";
