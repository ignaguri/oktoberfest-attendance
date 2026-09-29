import type { ShareLang } from "@prostcounter/shared";
import type { ShareCard } from "@prostcounter/shared/wrapped/server";
import { ImageResponse } from "next/og";
import sharp from "sharp";

import { loadCrest, loadFonts } from "./assets";
import { type LayoutContext, ogLayout, storyLayout } from "./layouts";
import { preparePhotos } from "./photos";
import { CARD_SIZE, OG_SIZE } from "./theme";
import { cardTranslator } from "./translate";

export const SHARE_IMAGE_VARIANTS = ["story", "og"] as const;
export type ShareImageVariant = (typeof SHARE_IMAGE_VARIANTS)[number];

const toJpeg = async (png: ArrayBuffer): Promise<Buffer> =>
  sharp(Buffer.from(png)).jpeg({ quality: 85, mozjpeg: true }).toBuffer();

async function renderStory(card: ShareCard, lang: ShareLang): Promise<Buffer> {
  const [fonts, t] = await Promise.all([loadFonts(), cardTranslator(lang)]);
  const context: LayoutContext = {
    t,
    formatNumber: (value) =>
      new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(value),
    formatDate: (isoDate) =>
      new Intl.DateTimeFormat(lang, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${isoDate}T00:00:00Z`)),
    crestDataUrl:
      card.kind === "persona" ? await loadCrest(card.personaId) : null,
    photoDataUrls:
      card.kind === "photos"
        ? await preparePhotos(card.photos.map((photo) => photo.pictureUrl))
        : [],
  };
  const image = new ImageResponse(storyLayout(card, context), {
    ...CARD_SIZE,
    fonts,
  });
  return toJpeg(await image.arrayBuffer());
}

/** One card as a JPEG: the 9:16 story, or the 1200x630 link preview built around it. */
export async function renderShareCard(
  card: ShareCard,
  { lang, variant }: { lang: ShareLang; variant: ShareImageVariant },
): Promise<Buffer> {
  const story = await renderStory(card, lang);
  if (variant === "story") {
    return story;
  }
  const [fonts, t] = await Promise.all([loadFonts(), cardTranslator(lang)]);
  const festival = String(card.kicker.params?.festival ?? "");
  const title = t({ key: "wrapped.shareCards.og.title", params: { festival } });
  const tagline = t({ key: "wrapped.shareCards.og.tagline" });
  const storyDataUrl = `data:image/jpeg;base64,${story.toString("base64")}`;
  const image = new ImageResponse(ogLayout(storyDataUrl, title, tagline), {
    ...OG_SIZE,
    fonts,
  });
  return toJpeg(await image.arrayBuffer());
}
