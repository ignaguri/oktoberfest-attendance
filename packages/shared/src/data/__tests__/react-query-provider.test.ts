import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { mapQueryOptions } from "../react-query-provider";

/**
 * Regression test for the retry-clobber bug (PROST-COUNTER-86 follow-up).
 *
 * `mapQueryOptions` used to always emit `retry: options.retry`, even when the
 * caller's `DataQueryOptions` omitted `retry` entirely. Since `options.retry`
 * is `undefined` in that case, the resulting `retry: undefined` was spread
 * into `useQuery(...)`'s per-query options, which React Query merges *over*
 * the QueryClient's `defaultOptions.queries.retry`. An explicit `undefined`
 * wins over the default, silently discarding any custom retry predicate
 * (e.g. mobile's `shouldRetryQuery`) and falling back to React Query's
 * built-in default of 3 retries.
 */
describe("mapQueryOptions", () => {
  it("does not clobber the QueryClient's default retry predicate when retry is omitted", () => {
    const sentinelRetry = (failureCount: number) => failureCount < 1;

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: sentinelRetry,
        },
      },
    });

    const mapped = mapQueryOptions({ staleTime: 30000 });

    const resolved = queryClient.defaultQueryOptions({
      queryKey: ["t"],
      queryFn: async () => 1,
      ...mapped,
    });

    expect(resolved.retry).toBe(sentinelRetry);
  });

  it("still forwards an explicit retry value, overriding the QueryClient default", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: () => true,
        },
      },
    });

    const mapped = mapQueryOptions({ staleTime: 30000, retry: 5 });

    const resolved = queryClient.defaultQueryOptions({
      queryKey: ["t"],
      queryFn: async () => 1,
      ...mapped,
    });

    expect(resolved.retry).toBe(5);
  });
});
