/**
 * React Query implementation of the data provider abstraction
 *
 * This is the shared implementation used by both web and mobile apps.
 * Each platform wraps this with their specific setup (e.g., "use client" for Next.js).
 */

import {
  useQuery as useReactQuery,
  useMutation as useReactMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useCallback } from "react";

import type {
  DataProvider,
  DataQueryResult,
  DataMutationResult,
  DataQueryOptions,
  DataMutationOptions,
} from "./types";

function mapQueryOptions(
  options?: DataQueryOptions
): Omit<UseQueryOptions, "queryKey" | "queryFn"> {
  if (!options) return {};

  return {
    enabled: options.enabled,
    gcTime: options.gcTime,
    staleTime: options.staleTime,
    retry: options.retry,
    refetchOnWindowFocus: options.refetchOnWindowFocus,
    refetchOnReconnect: options.refetchOnReconnect,
  };
}

function mapMutationOptions<TData, TVariables = unknown>(
  options?: DataMutationOptions<TData, TVariables>
): UseMutationOptions<TData, Error, TVariables> {
  if (!options) return {};

  return {
    onSuccess: options.onSuccess,
    onError: options.onError,
    onSettled: (data, error) => options.onSettled?.(data ?? null, error),
  };
}

/**
 * React Query implementation of useQuery
 */
export function useQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options?: DataQueryOptions
): DataQueryResult<T> {
  const query = useReactQuery({
    queryKey,
    queryFn,
    ...mapQueryOptions(options),
  });

  return {
    data: (query.data ?? null) as T | null,
    loading: query.isLoading,
    error: query.error,
    refetch: () => {
      query.refetch();
    },
    isInitialLoading: query.isLoading && query.isFetching && !query.data,
    isRefetching: query.isFetching && !query.isLoading,
  };
}

/**
 * React Query implementation of useMutation
 */
export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: DataMutationOptions<TData, TVariables>
): DataMutationResult<TData, TVariables> {
  const mutation = useReactMutation<TData, Error, TVariables>({
    mutationFn,
    ...mapMutationOptions<TData, TVariables>(options),
  });

  return {
    mutate: useCallback(
      async (variables: TVariables) => {
        return new Promise<TData>((resolve, reject) => {
          mutation.mutate(variables, {
            onSuccess: resolve,
            onError: reject,
          });
        });
      },
      [mutation]
    ),
    mutateAsync: useCallback(
      (variables: TVariables) => mutation.mutateAsync(variables),
      [mutation]
    ),
    loading: mutation.isPending,
    error: mutation.error,
    data: mutation.data ?? null,
    reset: mutation.reset,
  };
}

/**
 * Hook to access React Query client functions through abstraction
 */
export function useDataProvider(): DataProvider {
  const queryClient = useQueryClient();

  return {
    useQuery,
    useMutation,
    invalidateQueries: (queryKey?: readonly unknown[]) => {
      if (queryKey) {
        // Use predicate to match queries that start with the given key prefix
        queryClient.invalidateQueries({
          predicate: (query) => {
            const actualKey = query.queryKey;
            if (
              !Array.isArray(actualKey) ||
              actualKey.length < queryKey.length
            ) {
              return false;
            }
            // Check if the query key starts with the provided prefix
            for (let i = 0; i < queryKey.length; i++) {
              if (actualKey[i] !== queryKey[i]) {
                return false;
              }
            }
            return true;
          },
        });
      } else {
        queryClient.invalidateQueries();
      }
    },
    setQueryData: <T>(queryKey: readonly unknown[], data: T) => {
      queryClient.setQueryData(queryKey, data);
    },
    getQueryData: <T>(queryKey: readonly unknown[]) => {
      return queryClient.getQueryData<T>(queryKey);
    },
  };
}

/**
 * Utility hook to invalidate queries
 */
export function useInvalidateQueries() {
  const { invalidateQueries } = useDataProvider();

  return useCallback(
    (queryKey?: readonly unknown[]) => {
      invalidateQueries(queryKey);
    },
    [invalidateQueries]
  );
}

/**
 * Utility hook to set query data optimistically
 */
export function useSetQueryData() {
  const { setQueryData } = useDataProvider();

  return useCallback(
    <T>(queryKey: readonly unknown[], data: T) => {
      setQueryData(queryKey, data);
    },
    [setQueryData]
  );
}

/**
 * Utility hook to get cached query data
 */
export function useGetQueryData() {
  const { getQueryData } = useDataProvider();

  return useCallback(
    <T>(queryKey: readonly unknown[]) => {
      return getQueryData<T>(queryKey);
    },
    [getQueryData]
  );
}
