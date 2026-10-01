import { createRequire } from "node:module";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isNetworkUnreachableError } from "../logger";

describe("isNetworkUnreachableError", () => {
  it("matches the Android DNS failure from production", () => {
    expect(
      isNetworkUnreachableError(
        new Error(
          'fetch failed: java.net.UnknownHostException: Unable to resolve host "www.prostcounter.fun": No address associated with hostname',
        ),
      ),
    ).toBe(true);
  });

  it("matches the React Native fetch failure", () => {
    expect(isNetworkUnreachableError(new TypeError("Network request failed"))).toBe(true);
  });

  it("matches the iOS transport failures, whatever the device language", () => {
    // expo/fetch wraps the URLSession error's localized description, so the
    // text is in the user's language; only the "fetch failed" prefix is stable.
    for (const message of [
      "fetch failed: UnexpectedException: The network connection was lost. (at ExpoModulesCore/Promise.swift:56)",
      "fetch failed: UnexpectedException: La conexión de red se ha perdido. (at ExpoModulesCore/Promise.swift:56)",
      "fetch failed: UnexpectedException: Zeitüberschreitung bei der Anforderung. (at ExpoModulesCore/Promise.swift:56)",
    ]) {
      expect(isNetworkUnreachableError(new Error(message))).toBe(true);
    }
  });

  it("matches the prefixed string the sync manager stores for the banner", () => {
    expect(isNetworkUnreachableError("festivals: fetch failed: Unable to resolve host")).toBe(true);
  });

  it("ignores everything else", () => {
    expect(isNetworkUnreachableError(new Error("500 Internal Server Error"))).toBe(false);
    expect(isNetworkUnreachableError(null)).toBe(false);
    expect(isNetworkUnreachableError(undefined)).toBe(false);
  });
});

describe("logger.error Sentry policy in production", () => {
  // The logger loads Sentry with a runtime require(), which vi.mock does not
  // intercept, so the fake goes into Node's require cache instead.
  const nodeRequire = createRequire(import.meta.url);
  const sentryPath = nodeRequire.resolve("@sentry/react-native");
  const captureException = vi.fn();
  const captureMessage = vi.fn();
  const originalEntry = nodeRequire.cache[sentryPath];

  beforeEach(() => {
    captureException.mockClear();
    captureMessage.mockClear();
    nodeRequire.cache[sentryPath] = {
      id: sentryPath,
      filename: sentryPath,
      loaded: true,
      exports: { getClient: () => ({}), captureException, captureMessage },
    } as unknown as NodeJS.Module;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  });

  afterEach(() => {
    if (originalEntry) {
      nodeRequire.cache[sentryPath] = originalEntry;
    } else {
      delete nodeRequire.cache[sentryPath];
    }
    delete (globalThis as { __DEV__?: boolean }).__DEV__;
    vi.restoreAllMocks();
  });

  it("does not capture an unresolved-host failure", async () => {
    const { logger } = await import("../logger");
    logger.error(
      "[SyncManager] Pull festivals failed:",
      new Error("fetch failed: java.net.UnknownHostException: Unable to resolve host"),
    );
    expect(captureException).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("still captures any other error", async () => {
    const { logger } = await import("../logger");
    logger.error("[SyncManager] Pull festivals failed:", new Error("boom"));
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
