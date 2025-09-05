"use server";

import { getUser } from "@/lib/sharedActions";
import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

import type { Database } from "@/lib/database.types";
import type {
  GlobalPhotoSettingsFormData,
  GroupPhotoSettingsFormData,
  BulkPhotoVisibilityFormData,
} from "@/lib/schemas/photo-visibility";
import type { SupabaseClient } from "@/lib/types";

import "server-only";

type PhotoVisibility = Database["public"]["Enums"]["photo_visibility_enum"];

// Cache global photo settings for 5 minutes since they don't change frequently
const getCachedGlobalPhotoSettings = unstable_cache(
  async (userId: string, supabaseClient: SupabaseClient) => {
    const { data, error } = await supabaseClient.rpc(
      "get_user_photo_global_settings",
      {
        p_user_id: userId,
      },
    );

    if (error) {
      reportSupabaseException("getUserGlobalPhotoSettings", error, {
        id: userId,
      });
      throw new Error("Error fetching global photo settings");
    }

    return data?.[0] || { user_id: userId, hide_photos_from_all_groups: false };
  },
  ["user-photo-global-settings"],
  { revalidate: 300, tags: ["user-photo-settings"] }, // 5 minutes cache
);

// Global photo settings actions
export async function getUserGlobalPhotoSettings() {
  const user = await getUser();
  const supabase = createClient();
  return getCachedGlobalPhotoSettings(user.id, supabase);
}

export async function updateGlobalPhotoSettings(
  formData: GlobalPhotoSettingsFormData,
) {
  const supabase = createClient();
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
  revalidateTag("user-photo-settings");
  revalidatePath("/profile");

  return { success: true };
}

// Cache group photo settings for 5 minutes since they don't change frequently
const getCachedGroupPhotoSettings = unstable_cache(
  async (userId: string, groupId: string, supabaseClient: SupabaseClient) => {
    const { data, error } = await supabaseClient.rpc(
      "get_user_group_photo_settings",
      {
        p_user_id: userId,
        p_group_id: groupId,
      },
    );

    if (error) {
      reportSupabaseException("getUserGroupPhotoSettings", error, {
        id: userId,
      });
      throw new Error("Error fetching group photo settings");
    }

    return (
      data?.[0] || {
        user_id: userId,
        group_id: groupId,
        hide_photos_from_group: false,
      }
    );
  },
  ["user-group-photo-settings"],
  { revalidate: 300, tags: ["user-photo-settings"] }, // 5 minutes cache
);

// Group-specific photo settings actions
export async function getUserGroupPhotoSettings(groupId: string) {
  const user = await getUser();
  const supabase = createClient();
  return getCachedGroupPhotoSettings(user.id, groupId, supabase);
}

export async function updateGroupPhotoSettings(
  formData: GroupPhotoSettingsFormData,
) {
  const supabase = createClient();
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
  revalidateTag("user-photo-settings");
  revalidateTag("group-gallery");
  revalidatePath("/profile");
  revalidatePath(`/groups/${formData.group_id}`);

  return { success: true };
}

// Cache all user group photo settings for 5 minutes since they don't change frequently
const getCachedAllUserGroupPhotoSettings = unstable_cache(
  async (userId: string, supabaseClient: SupabaseClient) => {
    const { data, error } = await supabaseClient.rpc(
      "get_user_all_group_photo_settings",
      {
        p_user_id: userId,
      },
    );

    if (error) {
      reportSupabaseException("getAllUserGroupPhotoSettings", error, {
        id: userId,
      });
      throw new Error("Error fetching all group photo settings");
    }

    return data || [];
  },
  ["user-all-group-photo-settings"],
  { revalidate: 300, tags: ["user-photo-settings"] }, // 5 minutes cache
);

export async function getAllUserGroupPhotoSettings() {
  const user = await getUser();
  const supabase = createClient();
  return getCachedAllUserGroupPhotoSettings(user.id, supabase);
}

// Individual photo visibility actions
export async function updatePhotoVisibility(
  photoId: string,
  visibility: PhotoVisibility,
) {
  const supabase = createClient();
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
  revalidateTag("group-gallery");
  revalidatePath("/attendance");

  return { success: true };
}

export async function updateMultiplePhotosVisibility(
  formData: BulkPhotoVisibilityFormData,
) {
  const supabase = createClient();
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
  revalidateTag("group-gallery");
  revalidatePath("/attendance");

  return { success: true, updatedCount: formData.photo_ids.length };
}
