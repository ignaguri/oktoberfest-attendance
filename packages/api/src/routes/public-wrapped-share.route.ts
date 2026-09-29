import type { Database } from "@prostcounter/db";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@prostcounter/shared/i18n/core";
import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";

import { NotFoundError } from "../middleware/error";
import { SupabaseWrappedShareRepository } from "../repositories/supabase/wrapped-share.repository";
import { shareCardHash, shareImageCacheTag } from "../share-cards/public";
import {
  renderShareCard,
  SHARE_IMAGE_VARIANTS,
  type ShareImageVariant,
} from "../share-cards/render";

const app = new Hono();

/**
 * The URL carries the card's hash, so a new snapshot is a new URL and the CDN
 * can keep it for a year; revoking the link purges it by tag. Browsers get an
 * hour, since nothing can purge them. The long cache only holds if nothing else
 * gets an entry: a wrong hash or language is a 404, or anyone could mint fresh
 * renders by varying them.
 */
const BROWSER_CACHE = "public, max-age=3600";
const CDN_CACHE = "max-age=31536000";

function publicShareRepository(): SupabaseWrappedShareRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase credentials not configured");
  }
  return new SupabaseWrappedShareRepository(
    createClient<Database>(url, key, { auth: { persistSession: false } }),
  );
}

// GET /public/wrapped-shares/:token/:variant - a live link's image, no auth
app.get("/wrapped-shares/:token/:variant", async (c) => {
  const variant = c.req.param("variant");
  if (!(SHARE_IMAGE_VARIANTS as readonly string[]).includes(variant)) {
    throw new NotFoundError("Unknown share image");
  }
  const lang = c.req.query("lang");
  if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(lang ?? "")) {
    throw new NotFoundError("Unknown share image");
  }
  // The CDN keys on the raw query, so an extra or reordered parameter would be a fresh render
  const hash = c.req.query("v") ?? "";
  if (new URL(c.req.url).search !== `?lang=${lang}&v=${hash}`) {
    throw new NotFoundError("Unknown share image");
  }
  const share = await publicShareRepository().getPublic(c.req.param("token"));
  if (!share) {
    throw new NotFoundError("This Wrapped isn't shared anymore");
  }
  if (hash !== shareCardHash(share.card)) {
    throw new NotFoundError("Unknown share image");
  }
  const jpeg = await renderShareCard(share.card, {
    lang: lang as SupportedLanguage,
    variant: variant as ShareImageVariant,
  });
  return c.body(new Uint8Array(jpeg), 200, {
    "Content-Type": "image/jpeg",
    "Cache-Control": BROWSER_CACHE,
    "Vercel-CDN-Cache-Control": CDN_CACHE,
    "Vercel-Cache-Tag": shareImageCacheTag(c.req.param("token")),
  });
});

export default app;
