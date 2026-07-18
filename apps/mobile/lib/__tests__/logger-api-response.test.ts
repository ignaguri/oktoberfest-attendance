import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../logger";

describe("logger.logApiResponse Sentry policy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("routes 4xx to warn, not error", () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    logger.logApiResponse("GET", "https://example.test/api/v1/festivals?", 401, null);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("routes 5xx to error", () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    logger.logApiResponse("POST", "https://example.test/api/v1/groups/join-by-token", 500, null);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not log a 2xx as warn or error", () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    logger.logApiResponse("GET", "https://example.test/api/v1/profile", 200, {});
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
