import { describe, expect, it } from "vitest";

import { createGetBeerPictureUrl } from "./image-urls";

describe("createGetBeerPictureUrl", () => {
  it("encodes a nested storage path into the proxy's single segment", () => {
    const getBeerPictureUrl = createGetBeerPictureUrl({ strategy: "api-proxy" });

    expect(getBeerPictureUrl("user-1/festival-1/photo.webp")).toBe(
      "/api/image/user-1%2Ffestival-1%2Fphoto.webp?bucket=beer_pictures",
    );
  });

  it("builds a direct storage URL from the raw path", () => {
    const getBeerPictureUrl = createGetBeerPictureUrl({
      strategy: "direct-storage",
      supabaseUrl: "https://xyz.supabase.co",
    });

    expect(getBeerPictureUrl("user-1/festival-1/photo.webp")).toBe(
      "https://xyz.supabase.co/storage/v1/object/public/beer_pictures/user-1/festival-1/photo.webp",
    );
  });
});
