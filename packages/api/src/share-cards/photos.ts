import { createGetBeerPictureUrl } from "@prostcounter/shared";
import sharp from "sharp";

/** A URL scheme or a leading slash: anything that is not a plain storage path. */
const NOT_A_STORAGE_PATH = /^([a-z][a-z0-9+.-]*:|\/)/i;

const PHOTO_PX = 420;
const PHOTO_TIMEOUT_MS = 5000;

/**
 * Storage paths to small JPEG data URLs. Satori cannot read WebP (what mobile
 * uploads), so every photo goes through sharp. A photo that fails, or is not
 * a storage path, is dropped.
 */
export async function preparePhotos(paths: string[]): Promise<string[]> {
  const toUrl = createGetBeerPictureUrl({
    strategy: "direct-storage",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  });
  const results = await Promise.all(
    paths.map(async (path) => {
      // The server fetches these, so only our own storage is ever reachable
      if (NOT_A_STORAGE_PATH.test(path)) {
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
