import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

import type { NextRequest } from "next/server";

// Use Node.js runtime for Sharp image processing
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "You must be logged in to upload photos",
        },
        { status: 401 },
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const picture = formData.get("picture") as File | null;
    const attendanceId = formData.get("attendanceId") as string | null;
    const visibility = (formData.get("visibility") as string) || "public";

    // Validate required fields
    if (!picture) {
      return NextResponse.json(
        { error: "Bad Request", message: "No picture provided" },
        { status: 400 },
      );
    }

    if (!attendanceId) {
      return NextResponse.json(
        { error: "Bad Request", message: "No attendanceId provided" },
        { status: 400 },
      );
    }

    // Validate visibility
    if (visibility !== "public" && visibility !== "private") {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "visibility must be 'public' or 'private'",
        },
        { status: 400 },
      );
    }

    // Verify attendance belongs to user
    const { data: attendance, error: attendanceError } = await supabase
      .from("attendances")
      .select("id")
      .eq("id", attendanceId)
      .eq("user_id", user.id)
      .single();

    if (attendanceError || !attendance) {
      return NextResponse.json(
        {
          error: "Not Found",
          message: "Attendance not found or does not belong to you",
        },
        { status: 404 },
      );
    }

    // Read and compress image with Sharp
    const buffer = await picture.arrayBuffer();
    let compressedBuffer: Buffer;

    try {
      compressedBuffer = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF
        .resize({ width: 1000, height: 1000, fit: "inside" })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { error: "Processing Error", message: "Failed to process image" },
        { status: 422 },
      );
    }

    // Generate unique filename
    const fileName = `${user.id}_${attendanceId}_${uuidv4()}.webp`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("beer_pictures")
      .upload(fileName, compressedBuffer, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Upload Error", message: "Failed to upload image to storage" },
        { status: 500 },
      );
    }

    // Create database record using RPC function
    const { error: dbError } = await supabase.rpc("add_beer_picture", {
      p_user_id: user.id,
      p_attendance_id: attendanceId,
      p_picture_url: fileName,
      p_visibility: visibility as "public" | "private",
    });

    if (dbError) {
      // Try to clean up uploaded file on DB error
      await supabase.storage.from("beer_pictures").remove([fileName]);

      console.error("Database error:", dbError);
      return NextResponse.json(
        { error: "Database Error", message: "Failed to save photo record" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        fileName,
        message: "Photo uploaded successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Unexpected error in photo upload:", error);
    return NextResponse.json(
      { error: "Internal Error", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
