import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import NodeCache from "node-cache";

const imageCache = new NodeCache({ stdTTL: 86400 }); // Cache images for 24 hours

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = params.id;

  // Check if the image is cached
  const cachedImage = imageCache.get<Buffer>(id);
  if (cachedImage) {
    return new NextResponse(cachedImage, {
      status: 200,
      headers: { "Content-Type": getMimeType(id) },
    });
  }

  try {
    const supabase = createClient();

    const { data, error } = await supabase.storage
      .from("avatars")
      .download(`${id}`);

    if (error) {
      throw error;
    }

    const buffer = await data.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);

    // Cache the image
    imageCache.set(id, imageBuffer);

    const headers = new Headers();
    headers.set("Content-Type", getMimeType(id));

    return new NextResponse(imageBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error fetching image:", error);
    return NextResponse.json(
      { error: "Error fetching image" },
      { status: 500 },
    );
  }
}
