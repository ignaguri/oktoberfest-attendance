import { describe, expect, it } from "vitest";

import { parsePushPermissionHeader } from "../client-headers";

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
