import { describe, expect, it } from "vitest";
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

  it("matches the prefixed string the sync manager stores for the banner", () => {
    expect(isNetworkUnreachableError("festivals: fetch failed: Unable to resolve host")).toBe(true);
  });

  it("ignores everything else", () => {
    expect(isNetworkUnreachableError(new Error("500 Internal Server Error"))).toBe(false);
    expect(isNetworkUnreachableError(null)).toBe(false);
    expect(isNetworkUnreachableError(undefined)).toBe(false);
  });
});
