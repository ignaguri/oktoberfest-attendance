/**
 * Provider-agnostic data layer interfaces
 *
 * This abstraction allows easy switching between different state management solutions:
 * - TanStack React Query (current)
 * - react-shared-states (future)
 * - Any other data fetching/caching solution
 *
 * Components should only import from this file and business logic hooks,
 * never directly from the underlying provider (React Query, etc.)
 */

export interface DataQueryResult<T = unknown> {
  /** The fetched data, null while loading or on error */
  data: T | null;
  /** Loading state indicator */
  loading: boolean;
  /** Error object if the query failed */
  error: Error | null;
  /** Function to manually refetch the data */
  refetch: () => void;
  /** Whether this is the initial load */
  isInitialLoading?: boolean;
  /** Whether the data is stale and being refetched in background */
  isRefetching?: boolean;
}

export interface DataMutationResult<TData = unknown, TVariables = unknown> {
  /** Function to trigger the mutation */
  mutate: (variables: TVariables) => Promise<TData>;
  /** Function to trigger the mutation (alternative async interface) */
  mutateAsync: (variables: TVariables) => Promise<TData>;
  /** Loading state during mutation */
  loading: boolean;
  /** Error from the last mutation attempt */
  error: Error | null;
  /** Data returned from successful mutation */
  data: TData | null;
  /** Reset the mutation state */
  reset: () => void;
}

export interface DataQueryOptions {
  /** Whether the query should run automatically */
  enabled?: boolean;
  /** Garbage collection time in milliseconds */
  gcTime?: number;
  /** Stale time in milliseconds */
  staleTime?: number;
  /** Retry failed queries */
  retry?: boolean | number;
  /** Refetch on window focus */
  refetchOnWindowFocus?: boolean;
  /** Refetch on reconnect */
  refetchOnReconnect?: boolean;
}

export interface DataMutationOptions<TData = unknown, TVariables = unknown> {
  /** Called on successful mutation */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Called on mutation error */
  onError?: (error: Error) => void;
  /** Called when mutation settles (success or error) */
  onSettled?: (data: TData | null, error: Error | null) => void;
}

/**
 * Provider interface that must be implemented by each state management solution
 */
export interface DataProvider {
  useQuery: <T>(
    queryKey: readonly unknown[],
    queryFn: () => Promise<T>,
    options?: DataQueryOptions,
  ) => DataQueryResult<T>;

  useMutation: <TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: DataMutationOptions<TData, TVariables>,
  ) => DataMutationResult<TData, TVariables>;

  invalidateQueries: (queryKey?: readonly unknown[]) => void;
  setQueryData: <T>(queryKey: readonly unknown[], data: T) => void;
  getQueryData: <T>(queryKey: readonly unknown[]) => T | undefined;
}
