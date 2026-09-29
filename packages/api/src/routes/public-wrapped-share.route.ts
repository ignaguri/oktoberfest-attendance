import type { Database } from "@prostcounter/db";
import { ShareLangSchema } from "@prostcounter/shared";
import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";

import { NotFoundError } from "../middleware/error";
import { SupabaseWrappedShareRepository } from "../repositories/supabase/wrapped-share.repository";
import {
  renderShareCard,
  SHARE_IMAGE_VARIANTS,
  type ShareImageVariant,
} from "../share-cards/render";

const app = new Hono();

/** The URL carries the card's hash, so a new snapshot is a new URL and this can cache forever. */
const PUBLIC_CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";

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
  const lang = ShareLangSchema.parse(c.req.query("lang"));
  const share = await publicShareRepository().getPublic(c.req.param("token"));
  if (!share) {
    throw new NotFoundError("This Wrapped isn't shared anymore");
  }
  const jpeg = await renderShareCard(share.card, {
    lang,
    variant: variant as ShareImageVariant,
  });
  return c.body(new Uint8Array(jpeg), 200, {
    "Content-Type": "image/jpeg",
    "Cache-Control": PUBLIC_CACHE,
  });
});

export default app;
