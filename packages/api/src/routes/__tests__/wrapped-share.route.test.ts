import { buildShareCards } from "@prostcounter/shared/wrapped/server";
import { makeWrapped } from "@prostcounter/shared/wrapped/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockSupabase } from "../../__tests__/helpers/mock-supabase";
import {
  createAuthRequest,
  createMockUser,
  createTestApp,
} from "../../__tests__/helpers/test-server";
import { WrappedShareService } from "../../services/wrapped-share.service";
import { renderShareCard } from "../../share-cards/render";
import wrappedShareRoutes from "../wrapped-share.route";

vi.mock("../../services/wrapped-share.service", () => ({
  WrappedShareService: vi.fn(),
}));
vi.mock("../../utils/admin-client", () => ({
  createAdminClient: vi.fn(() => ({})),
}));
vi.mock("../../share-cards/render", () => ({
  SHARE_IMAGE_VARIANTS: ["story", "og"],
  renderShareCard: vi
    .fn()
    .mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
}));

const festivalId = "123e4567-e89b-12d3-a456-426614174000";
const [numbersCard] = buildShareCards(makeWrapped(), null);

describe("Wrapped share routes", () => {
  let app: ReturnType<typeof createTestApp>;
  const service = {
    getCard: vi.fn(),
    listLinks: vi.fn(),
    createLink: vi.fn(),
    revokeLink: vi.fn(),
  };

  beforeEach(() => {
    app = createTestApp();
    vi.mocked(WrappedShareService).mockImplementation(function () {
      return service as never;
    });
    app.use("*", async (c, next) => {
      c.set("user", createMockUser());
      c.set("supabase", createMockSupabase());
      await next();
    });
    app.route("/", wrappedShareRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("serves a private JPEG of the card", async () => {
    service.getCard.mockResolvedValue(numbersCard);
    const res = await app.request(
      createAuthRequest(`/wrapped/${festivalId}/share-cards/numbers?lang=de`),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(renderShareCard).toHaveBeenCalledWith(numbersCard, {
      lang: "de",
      variant: "story",
    });
  });

  it("falls back to English for an unknown lang", async () => {
    service.getCard.mockResolvedValue(numbersCard);
    await app.request(
      createAuthRequest(`/wrapped/${festivalId}/share-cards/numbers?lang=fr`),
    );
    expect(renderShareCard).toHaveBeenCalledWith(numbersCard, {
      lang: "en",
      variant: "story",
    });
  });

  it("rejects an unknown card kind", async () => {
    const res = await app.request(
      createAuthRequest(`/wrapped/${festivalId}/share-cards/tattoo`),
    );
    expect(res.status).toBe(400);
  });

  it("creates a link with a localized URL", async () => {
    service.createLink.mockResolvedValue("abc");
    const res = await app.request(
      createAuthRequest(`/wrapped/${festivalId}/share-links`, {
        method: "POST",
        body: JSON.stringify({ kind: "persona", lang: "de" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      kind: "persona",
      token: "abc",
      url: "http://localhost/de/w/abc",
    });
  });

  it("refuses a photos link", async () => {
    const res = await app.request(
      createAuthRequest(`/wrapped/${festivalId}/share-links`, {
        method: "POST",
        body: JSON.stringify({ kind: "photos", lang: "en" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(service.createLink).not.toHaveBeenCalled();
  });

  it("lists live links with English URLs unprefixed", async () => {
    service.listLinks.mockResolvedValue([{ token: "abc", kind: "numbers" }]);
    const res = await app.request(
      createAuthRequest(`/wrapped/${festivalId}/share-links?lang=en`),
    );
    expect(await res.json()).toEqual({
      links: [{ kind: "numbers", token: "abc", url: "http://localhost/w/abc" }],
    });
  });

  it("revokes a link", async () => {
    service.revokeLink.mockResolvedValue(undefined);
    const res = await app.request(
      createAuthRequest(`/wrapped/share-links/abc`, { method: "DELETE" }),
    );
    expect(res.status).toBe(200);
    expect(service.revokeLink).toHaveBeenCalledWith("test-user-id", "abc");
  });
});
