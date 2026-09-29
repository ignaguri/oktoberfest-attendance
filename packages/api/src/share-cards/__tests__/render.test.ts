import { fileURLToPath } from "node:url";

import { buildShareCards } from "@prostcounter/shared/wrapped";
import {
  makeOfficialStats,
  makeWrapped,
} from "@prostcounter/shared/wrapped/testing";
import sharp from "sharp";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { preparePhotos } from "../photos";
import { renderShareCard } from "../render";

const JPEG_MAGIC = [0xff, 0xd8, 0xff];

async function webpPhoto() {
  return sharp({
    create: { width: 800, height: 1200, channels: 3, background: "#884422" },
  })
    .webp()
    .toBuffer();
}

const realFetch = globalThis.fetch;

/** Answer photo downloads only; next/og loads its own WASM through fetch too. */
function stubPhotoFetch(respond: () => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
      String(input instanceof Request ? input.url : input).startsWith("http")
        ? respond()
        : realFetch(input, init),
    ),
  );
}

async function expectJpeg(buffer: Buffer, width: number, height: number) {
  expect([...buffer.subarray(0, 3)]).toEqual(JPEG_MAGIC);
  const meta = await sharp(buffer).metadata();
  expect([meta.width, meta.height]).toEqual([width, height]);
}

describe("renderShareCard", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://storage.test";
    process.env.SHARE_CARD_ASSETS_DIR = fileURLToPath(
      new URL("../../../../../apps/web/public", import.meta.url),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const cards = buildShareCards(makeWrapped(), makeOfficialStats());

  it.each(["numbers", "persona", "rhythm", "city"] as const)(
    "renders the %s card as a 1080x1920 JPEG",
    async (kind) => {
      const card = cards.find((candidate) => candidate.kind === kind);
      expect(card).toBeDefined();
      await expectJpeg(
        await renderShareCard(card!, { lang: "de", variant: "story" }),
        1080,
        1920,
      );
    },
    30_000,
  );

  it("renders the OG variant as 1200x630", async () => {
    await expectJpeg(
      await renderShareCard(cards[0], { lang: "en", variant: "og" }),
      1200,
      630,
    );
  }, 30_000);

  it("converts WebP photos before rendering", async () => {
    const photo = await webpPhoto();
    stubPhotoFetch(() => new Response(photo, { status: 200 }));
    const card = cards.find((candidate) => candidate.kind === "photos")!;
    expect(await preparePhotos(["user/beer.webp"])).toEqual([
      expect.stringMatching(/^data:image\/jpeg;base64,/),
    ]);
    await expectJpeg(
      await renderShareCard(card, { lang: "es", variant: "story" }),
      1080,
      1920,
    );
  }, 30_000);

  it("drops photos that fail to load", async () => {
    stubPhotoFetch(() => new Response("nope", { status: 404 }));
    const card = cards.find((candidate) => candidate.kind === "photos")!;
    expect(await preparePhotos(["user/beer.webp"])).toEqual([]);
    await expectJpeg(
      await renderShareCard(card, { lang: "en", variant: "story" }),
      1080,
      1920,
    );
  }, 30_000);

  it("renders a very long tent name", async () => {
    const [card] = buildShareCards(
      makeWrapped((data) => {
        data.tentStats.favoriteTent =
          "Hofbräu-Festzelt mit einem sehr langen Namen, der nie aufhört und weitergeht";
      }),
      null,
    );
    await expectJpeg(
      await renderShareCard(card, { lang: "de", variant: "story" }),
      1080,
      1920,
    );
  }, 30_000);
});
