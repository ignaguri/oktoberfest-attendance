import { describe, expect, it } from "vitest";

import { canRenderInboxAvatar } from "../inbox-avatar";

describe("canRenderInboxAvatar", () => {
  it("renders a photo URL", () => {
    expect(
      canRenderInboxAvatar("https://x.supabase.co/storage/v1/object/public/avatars/a.webp"),
    ).toBe(true);
  });

  it("falls back for Novu's stock SVG avatars, which React Native cannot draw", () => {
    expect(canRenderInboxAvatar("https://dashboard.novu.co/images/confetti.svg")).toBe(false);
    expect(canRenderInboxAvatar("https://example.com/icon.SVG?v=2")).toBe(false);
  });

  it("falls back when there is no avatar", () => {
    expect(canRenderInboxAvatar(undefined)).toBe(false);
    expect(canRenderInboxAvatar("")).toBe(false);
  });
});
