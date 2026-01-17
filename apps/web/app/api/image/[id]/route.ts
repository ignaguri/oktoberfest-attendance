import crypto from "crypto";
import { unstable_cache } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { createClient } from "@/utils/supabase/server";

// Use Node.js runtime for crypto and other Node-specific modules
export const runtime = "nodejs";

type AllowedBucket = "avatars" | "beer_pictures";

const ALLOWED_BUCKETS: Record<AllowedBucket, true> = {
  avatars: true,
  beer_pictures: true,
};

const getMimeType = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "heic":
    case "heif":
      return "image/heic";
    default:
      return "application/octet-stream";
  }
};

// Cache metadata retrieval for 24 hours
const getCachedImageMetadata = unstable_cache(
  async (bucket: string, filePath: string) => {
    // Use service role client - image metadata is public
    const supabase = await createClient(true);

    // Split path into directory and filename
    const pathParts = filePath.split("/");
    const fileName = pathParts.pop() || filePath;
    const directory = pathParts.join("/");

    const { data, error } = await supabase.storage
      .from(bucket)
      .list(directory, { search: fileName });

    if (error || !data || data.length === 0) {
      return null;
    }

    const file = data.find((f: any) => f.name === fileName);
    return file
      ? {
          size: file.metadata?.size || 0,
          lastModified: file.updated_at || file.created_at,
          name: file.name,
        }
      : null;
  },
  ["image-metadata"],
  { revalidate: 86400 }, // 24 hours
);

/**
 * Extract file path from a full Supabase storage URL or return the path as-is
 * Handles URLs like: http://localhost:54321/storage/v1/object/public/beer_pictures/userId/festivalId/file.jpg
 * Returns: userId/festivalId/file.jpg
 */
function extractFilePath(urlOrPath: string, bucket: string): string {
  // If it's already a path (doesn't start with http), return as-is
  if (!urlOrPath.startsWith("http")) {
    return urlOrPath;
  }

  try {
    const url = new URL(urlOrPath);
    const pathParts = url.pathname.split("/");
    // Find the bucket name in the path and get everything after it
    const bucketIndex = pathParts.indexOf(bucket);
    if (bucketIndex !== -1) {
      return pathParts.slice(bucketIndex + 1).join("/");
    }
    // Fallback: return everything after /public/
    const publicIndex = pathParts.indexOf("public");
    if (publicIndex !== -1) {
      return pathParts.slice(publicIndex + 2).join("/");
    }
    // Last resort: return original
    return urlOrPath;
  } catch {
    return urlOrPath;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let decodedId = decodeURIComponent(id);
  const { searchParams } = new URL(request.url);

  // Handle case where bucket param is encoded into the path (happens with Next.js Image optimization)
  // The URL might look like: /api/image/http%3A...%3Fbucket%3Dbeer_pictures
  // After decoding: /api/image/http://...?bucket=beer_pictures
  let bucketParam = searchParams.get("bucket");

  if (!bucketParam && decodedId.includes("?bucket=")) {
    const [pathPart, queryPart] = decodedId.split("?");
    decodedId = pathPart;
    const embeddedParams = new URLSearchParams(queryPart);
    bucketParam = embeddedParams.get("bucket");
  }

  bucketParam = bucketParam || "avatars";

  if (!ALLOWED_BUCKETS[bucketParam as AllowedBucket]) {
    return NextResponse.json(
      { error: "Invalid bucket specified" },
      { status: 400 },
    );
  }

  const bucket = bucketParam as AllowedBucket;

  // Extract file path from full URL or use as-is
  const filePath = extractFilePath(decodedId, bucket);

  try {
    // Create Supabase client outside cache scope
    const supabase = await createClient(true);

    // Try to download the file directly first
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (error) {
      logger.error(
        "Error downloading image from storage",
        logger.apiRoute("image/[id]", { imageId: filePath, bucket }),
        error as Error,
      );
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const arrayBuffer = await data.arrayBuffer();

    // Generate ETag based on content hash
    const etag = crypto
      .createHash("md5")
      .update(Buffer.from(arrayBuffer))
      .digest("hex");

    // Cache-Control strategy for authenticated image content:
    // - private: only browser cache, not CDN/proxy (since auth required)
    // - max-age=31536000: cache for 1 year (images have unique paths with timestamps)
    // - immutable: never revalidate (file paths are unique per upload)
    // - stale-while-revalidate=86400: serve stale while fetching new (1 day grace)
    const cacheControl =
      "private, max-age=31536000, immutable, stale-while-revalidate=86400";

    // Check If-None-Match header for conditional requests
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === `"${etag}"`) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": cacheControl,
          ETag: `"${etag}"`,
        },
      });
    }

    const headers = new Headers();
    headers.set("Content-Type", getMimeType(filePath));
    headers.set("Cache-Control", cacheControl);
    headers.set("ETag", `"${etag}"`);
    headers.set("Vary", "Accept-Encoding");

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    logger.error(
      "Error fetching image",
      logger.apiRoute("image/[id]", { imageId: filePath, bucket }),
      error as Error,
    );
    return NextResponse.json(
      { error: "Error fetching image" },
      { status: 500 },
    );
  }
}
