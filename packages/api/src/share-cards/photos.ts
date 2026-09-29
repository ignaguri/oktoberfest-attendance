import { createGetBeerPictureUrl } from "@prostcounter/shared";
import sharp from "sharp";

/** A URL scheme or a leading slash: anything that is not a plain storage path. */
const NOT_A_STORAGE_PATH = /^([a-z][a-z0-9+.-]*:|\/)/i;

/** Where legacy rows' full public URLs keep their storage path. */
const BUCKET_URL_PREFIX = "/storage/v1/object/public/beer_pictures/";

const PHOTO_PX = 420;
const PHOTO_TIMEOUT_MS = 5000;

/**
 * A storage path, or the path inside a legacy row's full URL. The server
 * fetches these, so a URL counts only if it points at our own bucket.
 */
function storagePath(value: string, supabaseUrl: string): string | null {
  if (!NOT_A_STORAGE_PATH.test(value)) {
    return value;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    !supabaseUrl ||
    url.origin !== new URL(supabaseUrl).origin ||
    !url.pathname.startsWith(BUCKET_URL_PREFIX) ||
    url.search
  ) {
    return null;
  }
  const path = decodeURIComponent(url.pathname.slice(BUCKET_URL_PREFIX.length));
  if (!path || NOT_A_STORAGE_PATH.test(path) || path.split("/").includes("..")) {
    return null;
  }
  return path;
}

/**
 * Storage paths to small JPEG data URLs. Satori cannot read WebP (what mobile
 * uploads), so every photo goes through sharp. A photo that fails, or is not
 * one of our photos, is dropped.
 */
export async function preparePhotos(paths: string[]): Promise<string[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const toUrl = createGetBeerPictureUrl({
    strategy: "direct-storage",
    supabaseUrl,
  });
  const results = await Promise.all(
    paths.map(async (value) => {
      const path = storagePath(value, supabaseUrl);
      if (!path) {
        return null;
      }
      const url = toUrl(path);
      if (!url) {
        return null;
      }
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS),
        });
        if (!response.ok) {
          return null;
        }
        const jpeg = await sharp(Buffer.from(await response.arrayBuffer()))
          .resize(PHOTO_PX, PHOTO_PX, { fit: "cover" })
          .jpeg({ quality: 82 })
          .toBuffer();
        return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((url): url is string => url !== null);
}
