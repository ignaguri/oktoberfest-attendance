import { describe, expect, it } from "vitest";

import { shouldReportHonoError } from "../sentry-options";

describe("shouldReportHonoError", () => {
  it("skips 401/403 and redirects, from either statusCode or status", () => {
    expect(shouldReportHonoError({ statusCode: 401 })).toBe(false);
    expect(shouldReportHonoError({ statusCode: 403 })).toBe(false);
    expect(shouldReportHonoError({ status: 403 })).toBe(false);
    expect(shouldReportHonoError({ status: 302 })).toBe(false);
  });

  it("reports other client errors and server errors", () => {
    expect(shouldReportHonoError({ statusCode: 400 })).toBe(true);
    expect(shouldReportHonoError({ status: 404 })).toBe(true);
    expect(shouldReportHonoError({ statusCode: 500 })).toBe(true);
    expect(shouldReportHonoError(new Error("boom"))).toBe(true);
  });
});
