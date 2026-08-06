"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";

import { reportLog, reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const file = formData.get("avatar") as File;
  const userId = formData.get("userId") as string;
  if (!file) {
    throw new Error("No file uploaded");
  }
  if (!userId) {
    throw new Error("User ID is required");
  }
  const buffer = await file.arrayBuffer();
  let compressedBuffer;
  try {
    // Imported here rather than at module scope: sharp carries native
    // bindings, and a top-level import puts it in the shared server chunk
    // every SSR route loads, so a broken binary takes down pages that have
    // nothing to do with images.
    const { default: sharp } = await import("sharp");
    compressedBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: 800, height: 800, fit: "inside" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    reportLog("Error compressing image: " + JSON.stringify(error), "error");
    throw new Error("Error compressing image");
  }
  const fileName = `${userId}_${uuidv4()}.webp`;
  const { error } = await supabase.storage.from("avatars").upload(fileName, compressedBuffer, {
    contentType: "image/webp",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    reportLog("Error uploading avatar: " + error.message, "error");
    throw new Error(`Error uploading avatar: ${error.message}`);
  }
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: fileName })
    .eq("id", userId);
  if (updateError) {
    reportSupabaseException("uploadAvatar", updateError, { id: userId });
    throw new Error("Error updating user profile");
  }

  revalidatePath("/profile");
  revalidatePath("/home");

  return fileName;
}
