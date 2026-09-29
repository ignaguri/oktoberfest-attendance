import { createHash } from "node:crypto";

import type { ShareLang } from "@prostcounter/shared";
import {
  SHARE_CARD_RENDER_VERSION,
  type ShareCard,
} from "@prostcounter/shared/wrapped/server";

export function shareCardHash(card: ShareCard): string {
  return createHash("sha256")
    .update(JSON.stringify(card))
    .update(SHARE_CARD_RENDER_VERSION)
    .digest("hex")
    .slice(0, 12);
}

/** CDN tag on all of a link's images, so revoking it can purge them. */
export function shareImageCacheTag(token: string): string {
  return `wrapped-share-${token}`;
}

/** Path (under the site origin) of a live link's image; the hash keys the CDN cache. */
export function publicShareImagePath(
  token: string,
  variant: "story" | "og",
  lang: ShareLang,
  card: ShareCard,
): string {
  return `/api/public/wrapped-shares/${encodeURIComponent(token)}/${variant}?lang=${lang}&v=${shareCardHash(card)}`;
}
