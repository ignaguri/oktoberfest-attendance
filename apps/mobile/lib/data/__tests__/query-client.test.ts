import { describe, expect, it } from "vitest";
import { ApiError, AuthRequiredError } from "@prostcounter/api-client";
import { shouldRetryQuery, shouldRetryMutation } from "../query-client";

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
