import { describe, expect, it, vi } from "vitest";
import { ApiError, AuthRequiredError } from "@prostcounter/api-client";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { refetchFailedQueries, shouldRetryQuery, shouldRetryMutation } from "../query-client";

describe("shouldRetryQuery", () => {
  it("does not retry a 4xx ApiError", () => {
    expect(shouldRetryQuery(0, new ApiError("UNAUTHORIZED", "no", 401))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("CONFLICT", "dup", 409))).toBe(false);
  });
  it("does not retry AuthRequiredError", () => {
    expect(shouldRetryQuery(0, new AuthRequiredError())).toBe(false);
  });
  it("retries a 5xx ApiError up to 2 times", () => {
    const e = new ApiError("DATABASE_ERROR", "boom", 500);
    expect(shouldRetryQuery(0, e)).toBe(true);
    expect(shouldRetryQuery(1, e)).toBe(true);
    expect(shouldRetryQuery(2, e)).toBe(false);
  });
  it("retries a network error (non-ApiError) up to 2 times", () => {
    const e = new Error("Network request failed");
    expect(shouldRetryQuery(0, e)).toBe(true);
    expect(shouldRetryQuery(2, e)).toBe(false);
  });
});

describe("shouldRetryMutation", () => {
  it("never retries an ApiError (server received the request)", () => {
    expect(shouldRetryMutation(0, new ApiError("DATABASE_ERROR", "boom", 500))).toBe(false);
    expect(shouldRetryMutation(0, new ApiError("CONFLICT", "dup", 409))).toBe(false);
  });
  it("never retries AuthRequiredError", () => {
    expect(shouldRetryMutation(0, new AuthRequiredError())).toBe(false);
  });
  it("retries a network error up to 2 times", () => {
    const e = new Error("Network request failed");
    expect(shouldRetryMutation(0, e)).toBe(true);
    expect(shouldRetryMutation(2, e)).toBe(false);
  });
});

describe("refetchFailedQueries", () => {
  function observe(queryClient: QueryClient, key: string, queryFn: () => Promise<string>) {
    const observer = new QueryObserver(queryClient, { queryKey: [key], queryFn, retry: false });
    return observer.subscribe(() => {});
  }

  it("refetches a query that failed before sign-in, and nothing else", async () => {
    const queryClient = new QueryClient();
    const festivalsFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new AuthRequiredError())
      .mockResolvedValueOnce("festivals");
    const healthyFn = vi.fn<() => Promise<string>>().mockResolvedValue("ok");
    const unsubscribeFestivals = observe(queryClient, "festivals", festivalsFn);
    const unsubscribeHealthy = observe(queryClient, "healthy", healthyFn);

    await vi.waitFor(() => {
      expect(queryClient.getQueryState(["festivals"])?.status).toBe("error");
      expect(queryClient.getQueryState(["healthy"])?.status).toBe("success");
    });

    await refetchFailedQueries(queryClient);

    expect(queryClient.getQueryData(["festivals"])).toBe("festivals");
    expect(festivalsFn).toHaveBeenCalledTimes(2);
    expect(healthyFn).toHaveBeenCalledTimes(1);

    unsubscribeFestivals();
    unsubscribeHealthy();
    queryClient.clear();
  });
});
