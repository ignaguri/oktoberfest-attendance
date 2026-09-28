import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES } from "../i18n/core";
import { SCREEN_LOCALES, screenFromSegments, screenFromWebPath } from "./screen";

describe("screenFromSegments (mobile)", () => {
  it("drops route groups and keeps param templates", () => {
    expect(screenFromSegments(["(tabs)", "home"])).toBe("/home");
    expect(screenFromSegments(["group-detail", "[id]", "messages"])).toBe(
      "/group-detail/[id]/messages",
    );
    expect(screenFromSegments([])).toBe("/");
  });
});

describe("screenFromWebPath (web)", () => {
  it("strips the locale prefix", () => {
    expect(screenFromWebPath("/de/attendance")).toBe("/attendance");
    expect(screenFromWebPath("/en")).toBe("/");
  });

  it("hides ids and usernames under dynamic parents", () => {
    expect(screenFromWebPath("/en/groups/3b9c2d1e-0f4a-4b5c-8d6e-7f8091a2b3c4/gallery")).toBe(
      "/groups/[id]/gallery",
    );
    expect(screenFromWebPath("/es/user/ignaguri")).toBe("/user/[id]");
    expect(screenFromWebPath("/en/group-settings/abc")).toBe("/group-settings/[id]");
  });

  it("hides a stray uuid anywhere", () => {
    expect(screenFromWebPath("/en/something/3b9c2d1e-0f4a-4b5c-8d6e-7f8091a2b3c4")).toBe(
      "/something/[id]",
    );
  });

  it("keeps the locale list in sync with i18n", () => {
    expect([...SCREEN_LOCALES].sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });
});
