import { buildShareCards } from "@prostcounter/shared/wrapped";
import { makeWrapped } from "@prostcounter/shared/wrapped/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestApp } from "../../__tests__/helpers/test-server";
import { renderShareCard } from "../../share-cards/render";
import publicWrappedShareRoutes from "../public-wrapped-share.route";

// vi.mock factories are hoisted above imports, so the mock fn must be hoisted too
const { getPublic } = vi.hoisted(() => ({ getPublic: vi.fn() }));
vi.mock("../../repositories/supabase/wrapped-share.repository", () => ({
  SupabaseWrappedShareRepository: vi.fn().mockImplementation(function () {
    return { getPublic };
  }),
}));
vi.mock("../../share-cards/render", () => ({
  SHARE_IMAGE_VARIANTS: ["story", "og"],
  renderShareCard: vi
    .fn()
    .mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
}));

const [card] = buildShareCards(makeWrapped(), null);

describe("Public Wrapped share images", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon";
    app = createTestApp();
    app.route("/public", publicWrappedShareRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("serves a live link's OG image with a long public cache", async () => {
    getPublic.mockResolvedValue({
      kind: "numbers",
      card,
      festivalName: "Oktoberfest 2026",
    });
    const res = await app.request(
      "/public/wrapped-shares/abc/og?lang=es&v=123",
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, s-maxage=31536000, immutable",
    );
    expect(renderShareCard).toHaveBeenCalledWith(card, {
      lang: "es",
      variant: "og",
    });
  });

  it("404s a revoked or unknown link", async () => {
    getPublic.mockResolvedValue(null);
    const res = await app.request("/public/wrapped-shares/gone/story");
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("404s an unknown variant", async () => {
    const res = await app.request("/public/wrapped-shares/abc/poster");
    expect(res.status).toBe(404);
    expect(getPublic).not.toHaveBeenCalled();
  });
});
