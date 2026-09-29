import { createHash } from "node:crypto";

import type { ShareLang } from "@prostcounter/shared";
import type { ShareCard } from "@prostcounter/shared/wrapped";

/** Bump whenever a layout changes, so cached public images refresh. */
export const RENDER_VERSION = "1";

export function shareCardHash(card: ShareCard): string {
  return createHash("sha256")
    .update(JSON.stringify(card))
    .update(RENDER_VERSION)
    .digest("hex")
    .slice(0, 12);
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
