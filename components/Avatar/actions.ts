"use server";

import { v4 as uuidv4 } from "uuid";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function getAvatarId(userId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error("Error getting user profile");
  }

  return data.avatar_url;
}

export async function uploadAvatar(formData: FormData) {
  const file = formData.get("avatar") as File;
  const userId = formData.get("userId") as string;

  if (!file) {
    throw new Error("No file uploaded");
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `${userId}_${uuidv4()}.${fileExt}`;

  const supabase = createClient();

  const { error } = await supabase.storage
    .from("avatars")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error("Error uploading avatar");
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: fileName })
    .eq("id", userId);

  if (updateError) {
    console.error("Error updating user profile:", updateError);
    throw new Error("Error updating user profile");
  }

  revalidatePath("/profile");
  return fileName;
}
