import { describe, expect, it } from "vitest";

import {
  parseClientPlatformHeader,
  parseClientVersionHeader,
  parsePushPermissionHeader,
} from "../client-headers";

describe("parsePushPermissionHeader", () => {
  it("accepts the three statuses the mobile app reports", () => {
    expect(parsePushPermissionHeader("granted")).toBe("granted");
    expect(parsePushPermissionHeader("denied")).toBe("denied");
    expect(parsePushPermissionHeader("undetermined")).toBe("undetermined");
  });

  it("treats a missing header as absent", () => {
    expect(parsePushPermissionHeader(undefined)).toBeUndefined();
  });

  it("treats anything else as absent rather than guessing", () => {
    expect(parsePushPermissionHeader("")).toBeUndefined();
    expect(parsePushPermissionHeader("Granted")).toBeUndefined();
    expect(parsePushPermissionHeader(" granted")).toBeUndefined();
    expect(parsePushPermissionHeader("provisional")).toBeUndefined();
  });
});

describe("parseClientPlatformHeader", () => {
  it("accepts ios, android and web only", () => {
    expect(parseClientPlatformHeader("ios")).toBe("ios");
    expect(parseClientPlatformHeader("android")).toBe("android");
    expect(parseClientPlatformHeader("web")).toBe("web");
    expect(parseClientPlatformHeader("windows")).toBeUndefined();
    expect(parseClientPlatformHeader(undefined)).toBeUndefined();
  });
});

describe("parseClientVersionHeader", () => {
  it("bounds the version and drops empty values", () => {
    expect(parseClientVersionHeader("1.7.0")).toBe("1.7.0");
    expect(parseClientVersionHeader("")).toBeUndefined();
    expect(parseClientVersionHeader("9".repeat(100))).toHaveLength(32);
  });
});
