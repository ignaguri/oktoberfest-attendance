"use server";

import { getUser } from "@/lib/sharedActions";
import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";

import type {
  GlobalPhotoSettingsFormData,
  GroupPhotoSettingsFormData,
  BulkPhotoVisibilityFormData,
} from "@/lib/schemas/photo-visibility";
import type { Database } from "@prostcounter/db";

import "server-only";

type PhotoVisibility = Database["public"]["Enums"]["photo_visibility_enum"];

// Global photo settings actions
// No caching - user-specific data, RLS must be enforced
export async function getUserGlobalPhotoSettings() {
  const user = await getUser();
  const supabase = await createClient(); // Use authenticated client for RLS

  const { data, error } = await supabase.rpc("get_user_photo_global_settings", {
    p_user_id: user.id,
  });

  if (error) {
    reportSupabaseException("getUserGlobalPhotoSettings", error, {
      id: user.id,
    });
    throw new Error("Error fetching global photo settings");
  }

  return data?.[0] || { user_id: user.id, hide_photos_from_all_groups: false };
}

export async function updateGlobalPhotoSettings(
  formData: GlobalPhotoSettingsFormData,
) {
  const supabase = await createClient();
  const user = await getUser();

  const { error } = await supabase.rpc("update_user_photo_global_settings", {
    p_user_id: user.id,
    p_hide_photos_from_all_groups: formData.hide_photos_from_all_groups,
  });

  if (error) {
    reportSupabaseException("updateGlobalPhotoSettings", error, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error updating global photo settings");
  }

  // Invalidate relevant caches
  revalidateTag("user-photo-settings", "max");
  revalidatePath("/profile");

  return { success: true };
}

// Group-specific photo settings actions
// No caching - user-specific data, RLS must be enforced
export async function getUserGroupPhotoSettings(groupId: string) {
  const user = await getUser();
  const supabase = await createClient(); // Use authenticated client for RLS

  const { data, error } = await supabase.rpc("get_user_group_photo_settings", {
    p_user_id: user.id,
    p_group_id: groupId,
  });

  if (error) {
    reportSupabaseException("getUserGroupPhotoSettings", error, {
      id: user.id,
    });
    throw new Error("Error fetching group photo settings");
  }

  return (
    data?.[0] || {
      user_id: user.id,
      group_id: groupId,
      hide_photos_from_group: false,
    }
  );
}

export async function updateGroupPhotoSettings(
  formData: GroupPhotoSettingsFormData,
) {
  const supabase = await createClient();
  const user = await getUser();

  const { error } = await supabase.rpc("update_user_group_photo_settings", {
    p_user_id: user.id,
    p_group_id: formData.group_id,
    p_hide_photos_from_group: formData.hide_photos_from_group,
  });

  if (error) {
    reportSupabaseException("updateGroupPhotoSettings", error, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error updating group photo settings");
  }

  // Invalidate relevant caches
  revalidateTag("user-photo-settings", "max");
  revalidateTag("group-gallery", "max");
  revalidatePath("/profile");
  revalidatePath(`/groups/${formData.group_id}`);

  return { success: true };
}

// No caching - user-specific data, RLS must be enforced
export async function getAllUserGroupPhotoSettings() {
  const user = await getUser();
  const supabase = await createClient(); // Use authenticated client for RLS

  const { data, error } = await supabase.rpc(
    "get_user_all_group_photo_settings",
    {
      p_user_id: user.id,
    },
  );

  if (error) {
    reportSupabaseException("getAllUserGroupPhotoSettings", error, {
      id: user.id,
    });
    throw new Error("Error fetching all group photo settings");
  }

  return data || [];
}

// Individual photo visibility actions
export async function updatePhotoVisibility(
  photoId: string,
  visibility: PhotoVisibility,
) {
  const supabase = await createClient();
  const user = await getUser();

  // First verify the photo belongs to the user
  const { data: photo, error: photoError } = await supabase
    .from("beer_pictures")
    .select("user_id")
    .eq("id", photoId)
    .single();

  if (photoError || !photo || photo.user_id !== user.id) {
    throw new Error("Photo not found or access denied");
  }

  const { error } = await supabase
    .from("beer_pictures")
    .update({ visibility })
    .eq("id", photoId);

  if (error) {
    reportSupabaseException("updatePhotoVisibility", error, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error updating photo visibility");
  }

  // Invalidate relevant caches
  revalidateTag("group-gallery", "max");
  revalidatePath("/attendance");

  return { success: true };
}

export async function updateMultiplePhotosVisibility(
  formData: BulkPhotoVisibilityFormData,
) {
  const supabase = await createClient();
  const user = await getUser();

  // First verify all photos belong to the user
  const { data: photos, error: photosError } = await supabase
    .from("beer_pictures")
    .select("id, user_id")
    .in("id", formData.photo_ids);

  if (photosError) {
    reportSupabaseException(
      "updateMultiplePhotosVisibility - verify",
      photosError,
      {
        id: user.id,
        email: user.email,
      },
    );
    throw new Error("Error verifying photo ownership");
  }

  const unauthorizedPhotos =
    photos?.filter((photo) => photo.user_id !== user.id) || [];
  if (unauthorizedPhotos.length > 0) {
    throw new Error("Some photos do not belong to the current user");
  }

  // Update visibility for all photos
  const { error } = await supabase
    .from("beer_pictures")
    .update({ visibility: formData.visibility })
    .in("id", formData.photo_ids);

  if (error) {
    reportSupabaseException("updateMultiplePhotosVisibility", error, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error updating photos visibility");
  }

  // Invalidate relevant caches
  revalidateTag("group-gallery", "max");
  revalidatePath("/attendance");

  return { success: true, updatedCount: formData.photo_ids.length };
}
