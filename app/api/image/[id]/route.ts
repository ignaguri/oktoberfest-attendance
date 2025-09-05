import { logger } from "@/lib/logger";
import { createClient } from "@/utils/supabase/server";
import crypto from "crypto";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import type { SupabaseClient } from "@/lib/types";
import type { NextRequest } from "next/server";

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
    default:
      return "application/octet-stream";
  }
};

// Cache metadata retrieval for 24 hours
const getCachedImageMetadata = unstable_cache(
  async (bucket: string, fileName: string, supabaseClient: SupabaseClient) => {
    const { data, error } = await supabaseClient.storage
      .from(bucket)
      .list("", { search: fileName });

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { searchParams } = new URL(request.url);
  const bucketParam = searchParams.get("bucket") || "avatars";

  if (!ALLOWED_BUCKETS[bucketParam as AllowedBucket]) {
    return NextResponse.json(
      { error: "Invalid bucket specified" },
      { status: 400 },
    );
  }

  const bucket = bucketParam as AllowedBucket;

  try {
    // Create Supabase client outside cache scope
    const supabase = createClient(true);

    // Get image metadata for ETag generation
    const metadata = await getCachedImageMetadata(bucket, decodedId, supabase);
    if (!metadata) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Generate ETag based on file metadata
    const etag = crypto
      .createHash("md5")
      .update(
        `${bucket}:${decodedId}:${metadata.lastModified}:${metadata.size}`,
      )
      .digest("hex");

    // Check If-None-Match header for conditional requests
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === `"${etag}"`) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": "public, max-age=2592000, immutable", // 30 days
          ETag: `"${etag}"`,
        },
      });
    }

    // Fetch the actual image data
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(decodedId);

    if (error) {
      throw error;
    }

    const arrayBuffer = await data.arrayBuffer();
    const lastModified = new Date(metadata.lastModified).toUTCString();

    const headers = new Headers();
    headers.set("Content-Type", getMimeType(decodedId));
    headers.set("Cache-Control", "public, max-age=2592000, immutable"); // 30 days
    headers.set("ETag", `"${etag}"`);
    headers.set("Last-Modified", lastModified);
    headers.set("Vary", "Accept-Encoding");

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    logger.error(
      "Error fetching image",
      logger.apiRoute("image/[id]", { imageId: decodedId, bucket }),
      error as Error,
    );
    return NextResponse.json(
      { error: "Error fetching image" },
      { status: 500 },
    );
  }
}
