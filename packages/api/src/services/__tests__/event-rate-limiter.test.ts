import { describe, expect, it } from "vitest";

import { createEventRateLimiter } from "../event-rate-limiter";

describe("createEventRateLimiter", () => {
  it("allows up to the limit per window, then nothing", () => {
    const limiter = createEventRateLimiter(10, 60_000);
    expect(limiter.take("u1", 6, 0)).toBe(6);
    expect(limiter.take("u1", 6, 1_000)).toBe(4);
    expect(limiter.take("u1", 1, 2_000)).toBe(0);
  });

  it("resets after the window", () => {
    const limiter = createEventRateLimiter(10, 60_000);
    limiter.take("u1", 10, 0);
    expect(limiter.take("u1", 3, 60_000)).toBe(3);
  });

  it("counts users separately", () => {
    const limiter = createEventRateLimiter(5, 60_000);
    limiter.take("u1", 5, 0);
    expect(limiter.take("u2", 5, 0)).toBe(5);
  });
});
