import { ErrorCodes } from "@prostcounter/shared/errors";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

import { createClient } from "@/utils/supabase/server";

// Use Node.js runtime for Sharp image processing
export const runtime = "nodejs";

/**
 * Helper to create error responses with consistent format
 */
function errorResponse(
  code: string,
  message: string,
  status: number,
): NextResponse {
  return NextResponse.json(
    {
      error: { code, message, statusCode: status },
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        "You must be logged in to upload photos",
        401,
      );
    }

    // Parse FormData (type assertion needed due to Node.js/Web API FormData conflict)
    const formData = (await request.formData()) as unknown as FormData & {
      get(name: string): FormDataEntryValue | null;
    };
    const picture = formData.get("picture") as File | null;
    const attendanceId = formData.get("attendanceId") as string | null;
    const visibility = (formData.get("visibility") as string) || "public";

    // Validate required fields
    if (!picture) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "No picture provided",
        400,
      );
    }

    if (!attendanceId) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "No attendanceId provided",
        400,
      );
    }

    // Validate visibility
    if (visibility !== "public" && visibility !== "private") {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "visibility must be 'public' or 'private'",
        400,
      );
    }

    // Check file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (picture.size > MAX_FILE_SIZE) {
      return errorResponse(
        ErrorCodes.FILE_TOO_LARGE,
        "File size exceeds 10MB limit",
        400,
      );
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(picture.type)) {
      return errorResponse(
        ErrorCodes.INVALID_FILE_TYPE,
        "Invalid file type. Supported: JPEG, PNG, GIF, WebP",
        400,
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
      return errorResponse(
        ErrorCodes.ATTENDANCE_NOT_FOUND,
        "Attendance not found or does not belong to you",
        404,
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
      return errorResponse(
        ErrorCodes.PHOTO_UPLOAD_FAILED,
        "Failed to process image",
        422,
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
      return errorResponse(
        ErrorCodes.PHOTO_UPLOAD_FAILED,
        "Failed to upload image to storage",
        500,
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
      return errorResponse(
        ErrorCodes.DATABASE_ERROR,
        "Failed to save photo record",
        500,
      );
    }

    return NextResponse.json(
      {
        success: true,
        pictureUrl: fileName,
        message: "Photo uploaded successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Unexpected error in photo upload:", error);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "An unexpected error occurred",
      500,
    );
  }
}
