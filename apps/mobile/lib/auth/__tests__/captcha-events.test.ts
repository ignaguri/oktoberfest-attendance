import { describe, expect, it } from "vitest";

import { classifyCaptchaEvent } from "../captcha-events";

// A real token is a long opaque string; the library's own token test is
// `data.length > 35`, and it sets success=true only for those.
const REAL_TOKEN = "P0_eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.abcdefghijklmnop";

describe("classifyCaptchaEvent", () => {
  it("treats 'open' as not-a-result", () => {
    expect(classifyCaptchaEvent("open", true)).toEqual({ status: "pending" });
  });

  it("returns the token when the library marks the event successful", () => {
    expect(classifyCaptchaEvent(REAL_TOKEN, true)).toEqual({
      status: "token",
      token: REAL_TOKEN,
    });
  });

  describe("payloads that must never be mistaken for a token", () => {
    // Every one of these is a real string the library posts. Before the fix,
    // each fell through to be sent to GoTrue as a captcha token.
    const nonTokens = [
      "challenge-closed", // user closed the challenge: the common path
      "script-error", // hCaptcha's api.js failed to load
      "sms-open-failed",
      "rate-limited", // raw hCaptcha error-callback codes
      "network-error",
      "challenge-error",
      "invalid-data",
      "TypeError", // a bare exception name from a failed render
    ];

    for (const data of nonTokens) {
      it(`does not return a token for '${data}'`, () => {
        const result = classifyCaptchaEvent(data, false);
        expect(result.status).not.toBe("token");
        expect(result).not.toHaveProperty("token");
      });
    }
  });

  it("reports the user's own close as a cancel, not an error", () => {
    expect(classifyCaptchaEvent("challenge-closed", false)).toEqual({ status: "cancelled" });
  });

  it("reports a backdrop press as a cancel", () => {
    // The library raises this one itself and omits `success` entirely.
    expect(classifyCaptchaEvent("cancel")).toEqual({ status: "cancelled" });
  });

  it("separates a genuine failure from a cancel", () => {
    expect(classifyCaptchaEvent("error", false)).toEqual({ status: "error" });
    expect(classifyCaptchaEvent("expired", false)).toEqual({ status: "error" });
    expect(classifyCaptchaEvent("script-error", false)).toEqual({ status: "error" });
  });

  it("does not trust a token-shaped payload the library marked unsuccessful", () => {
    // Length alone must not qualify a payload: `success` is the authority.
    expect(classifyCaptchaEvent(REAL_TOKEN, false).status).toBe("error");
  });

  it("treats a missing success field as unsuccessful", () => {
    expect(classifyCaptchaEvent(REAL_TOKEN).status).toBe("error");
  });
});
