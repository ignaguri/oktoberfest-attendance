import { describe, expect, it } from "vitest";

import { RegisterLiveActivityTokenSchema } from "../live-activity.schema";

const base = {
  festivalId: "123e4567-e89b-12d3-a456-426614174000",
  date: "2026-10-03",
};

describe("RegisterLiveActivityTokenSchema", () => {
  it("accepts a hex iOS token", () => {
    const parsed = RegisterLiveActivityTokenSchema.safeParse({
      ...base,
      platform: "ios",
      token: "AB12".repeat(16),
      apnsEnvironment: "production",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an iOS token that is not hex", () => {
    for (const token of ["../../3/device/x", "ab".repeat(16), "zz".repeat(32)]) {
      const parsed = RegisterLiveActivityTokenSchema.safeParse({
        ...base,
        platform: "ios",
        token,
        apnsEnvironment: "production",
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("leaves Android's Expo token format alone", () => {
    const parsed = RegisterLiveActivityTokenSchema.safeParse({
      ...base,
      platform: "android",
      token: "ExponentPushToken[abc]",
      apnsEnvironment: null,
    });
    expect(parsed.success).toBe(true);
  });
});
