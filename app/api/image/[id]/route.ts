import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = params.id;

  try {
    const supabase = createClient();

    const { data, error } = await supabase.storage
      .from("avatars")
      .download(`${id}`);

    if (error) {
      throw error;
    }

    const buffer = await data.arrayBuffer();
    const headers = new Headers();
    headers.set("Content-Type", "image/jpeg");

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: headers,
    });
  } catch (error) {
    console.error("Error fetching image:", error);
    return NextResponse.json(
      { error: "Error fetching image" },
      { status: 500 },
    );
  }
}
