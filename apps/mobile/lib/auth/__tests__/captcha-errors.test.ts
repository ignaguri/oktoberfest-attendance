import { describe, expect, it } from "vitest";

import { isCaptchaRejection } from "../captcha-errors";

describe("isCaptchaRejection", () => {
  it("matches the GoTrue captcha failure code", () => {
    expect(isCaptchaRejection({ message: "captcha_failed" })).toBe(true);
  });

  it("matches the GoTrue request-disallowed phrasing", () => {
    expect(isCaptchaRejection({ message: "captcha protection: request disallowed" })).toBe(true);
  });

  it("matches regardless of casing", () => {
    expect(isCaptchaRejection({ message: "Captcha verification failed" })).toBe(true);
  });

  it("does not match ordinary auth errors", () => {
    expect(isCaptchaRejection({ message: "Invalid login credentials" })).toBe(false);
  });

  it("handles a missing message", () => {
    expect(isCaptchaRejection({})).toBe(false);
  });

  it("handles null and undefined", () => {
    expect(isCaptchaRejection(null)).toBe(false);
    expect(isCaptchaRejection(undefined)).toBe(false);
  });
});
