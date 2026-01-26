import type { Database } from "@prostcounter/db";
import type {
  BeerPicture,
  GetPhotoUploadUrlQuery,
  GetPhotoUploadUrlResponse,
  GlobalPhotoSettings,
  GroupPhotoSettings,
  PhotoVisibility,
} from "@prostcounter/shared";
import { replaceLocalhostInUrl } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DatabaseError,
  ForbiddenError,
  NotFoundError,
} from "../../middleware/error";
import type { IPhotoRepository } from "../interfaces/photo.repository";

export class SupabasePhotoRepository implements IPhotoRepository {
  private readonly BUCKET_NAME = "beer_pictures";
  private readonly UPLOAD_URL_EXPIRY = 60 * 5; // 5 minutes

  constructor(private supabase: SupabaseClient<Database>) {}

  async getUploadUrl(
    userId: string,
    query: GetPhotoUploadUrlQuery,
  ): Promise<GetPhotoUploadUrlResponse> {
    // Verify attendance belongs to user
    const { data: attendance, error: attError } = await this.supabase
      .from("attendances")
      .select("id")
      .eq("id", query.attendanceId)
      .eq("user_id", userId)
      .single();

    if (attError || !attendance) {
      throw new ForbiddenError("Attendance not found or access denied");
    }

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = query.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${userId}/${query.festivalId}/${timestamp}_${sanitizedFileName}`;

    // Create signed upload URL
    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .createSignedUploadUrl(filePath, {
        upsert: false,
      });

    if (uploadError || !uploadData) {
      throw new DatabaseError(
        `Failed to generate upload URL: ${uploadError?.message || "Unknown error"}`,
      );
    }

    // Pre-create beer_pictures record with just the path (like avatars)
    // Client utilities will construct the full URL
    const { data: picture, error: pictureError } = await this.supabase
      .from("beer_pictures")
      .insert({
        user_id: userId,
        attendance_id: query.attendanceId,
        picture_url: filePath, // Store only the path, not full URL
        visibility: "public", // Default to public so photos show in group galleries
      })
      .select()
      .single();

    if (pictureError) {
      throw new DatabaseError(
        `Failed to create picture record: ${pictureError.message}`,
      );
    }

    // Replace localhost with actual network IP for mobile access (upload URLs only)
    const supabaseUrl =
      process.env.SUPABASE_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "";
    const uploadUrl = replaceLocalhostInUrl(uploadData.signedUrl, supabaseUrl);

    // Get public URL for the response (but don't store it)
    const { data: publicUrlData } = this.supabase.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(filePath);
    const publicUrl = replaceLocalhostInUrl(
      publicUrlData.publicUrl,
      supabaseUrl,
    );

    return {
      uploadUrl,
      publicUrl,
      expiresIn: this.UPLOAD_URL_EXPIRY,
      pictureId: picture.id,
    };
  }

  async confirmUpload(pictureId: string, userId: string): Promise<BeerPicture> {
    // Verify ownership
    const { data, error } = await this.supabase
      .from("beer_pictures")
      .select("*")
      .eq("id", pictureId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      throw new NotFoundError("Picture not found");
    }

    // Picture record already exists from getUploadUrl, just return it
    return this.mapToBeerPicture(data);
  }

  async findByAttendance(
    attendanceId: string,
    userId: string,
  ): Promise<BeerPicture[]> {
    // Verify attendance ownership
    const { data: attendance, error: attError } = await this.supabase
      .from("attendances")
      .select("id")
      .eq("id", attendanceId)
      .eq("user_id", userId)
      .single();

    if (attError || !attendance) {
      throw new ForbiddenError("Attendance not found or access denied");
    }

    const { data, error } = await this.supabase
      .from("beer_pictures")
      .select()
      .eq("attendance_id", attendanceId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch pictures: ${error.message}`);
    }

    return data.map((p) => this.mapToBeerPicture(p));
  }

  async list(
    userId: string,
    festivalId?: string,
    limit = 50,
    offset = 0,
  ): Promise<{ data: BeerPicture[]; total: number }> {
    let query = this.supabase
      .from("beer_pictures")
      .select("*, attendances!inner(user_id, festival_id)", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (festivalId) {
      query = query.eq("attendances.festival_id", festivalId);
    }

    const { data, error, count } = await query.range(
      offset,
      offset + limit - 1,
    );

    if (error) {
      throw new DatabaseError(`Failed to list pictures: ${error.message}`);
    }

    return {
      data: data.map((p) => this.mapToBeerPicture(p)),
      total: count || 0,
    };
  }

  async delete(pictureId: string, userId: string): Promise<void> {
    // Verify ownership
    const { data, error: selectError } = await this.supabase
      .from("beer_pictures")
      .select("picture_url")
      .eq("id", pictureId)
      .eq("user_id", userId)
      .single();

    if (selectError || !data) {
      throw new NotFoundError("Picture not found");
    }

    // picture_url now stores just the path (userId/festivalId/timestamp_filename)
    // not a full URL, so we can use it directly
    let filePath = data.picture_url;

    // If for some reason it's still a full URL (legacy data), extract the path
    if (filePath.startsWith("http")) {
      try {
        const url = new URL(filePath);
        const pathParts = url.pathname.split("/");
        filePath = pathParts
          .slice(pathParts.indexOf(this.BUCKET_NAME) + 1)
          .join("/");
      } catch {
        // If URL parsing fails, assume it's already a path
      }
    }

    // Delete from storage
    const { error: storageError } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .remove([filePath]);

    if (storageError) {
      // Log but don't fail - database record is more important
      console.warn(
        `Failed to delete file from storage: ${storageError.message}`,
      );
    }

    // Delete database record
    const { error: dbError } = await this.supabase
      .from("beer_pictures")
      .delete()
      .eq("id", pictureId)
      .eq("user_id", userId);

    if (dbError) {
      throw new DatabaseError(`Failed to delete picture: ${dbError.message}`);
    }
  }

  /**
   * Delete all photo records for an attendance (DB only, keeps storage files)
   * Used when deleting an attendance to avoid FK constraint violation.
   * Storage files are kept for potential data restoration.
   */
  async deleteByAttendanceId(
    attendanceId: string,
    userId: string,
  ): Promise<void> {
    // Delete database records only (keep storage files for potential restoration)
    const { error: dbError } = await this.supabase
      .from("beer_pictures")
      .delete()
      .eq("attendance_id", attendanceId)
      .eq("user_id", userId);

    if (dbError) {
      throw new DatabaseError(`Failed to delete pictures: ${dbError.message}`);
    }
  }

  async updateCaption(
    pictureId: string,
    userId: string,
    caption: string,
  ): Promise<BeerPicture> {
    // Note: Current schema doesn't have caption field
    // This is a stub for future enhancement
    // TODO: Add caption field to beer_pictures table
    throw new DatabaseError(
      "Caption feature not yet implemented - schema needs update",
    );
  }

  private mapToBeerPicture(data: any): BeerPicture {
    // Store only the path, client utilities will construct the full URL
    return {
      id: data.id,
      userId: data.user_id,
      attendanceId: data.attendance_id,
      pictureUrl: data.picture_url,
      visibility: data.visibility,
      createdAt: data.created_at,
    };
  }

  // ===== Photo Privacy Settings =====

  async getGlobalPhotoSettings(userId: string): Promise<GlobalPhotoSettings> {
    const { data, error } = await this.supabase.rpc(
      "get_user_photo_global_settings",
      {
        p_user_id: userId,
      },
    );

    if (error) {
      throw new DatabaseError(
        `Failed to fetch global photo settings: ${error.message}`,
      );
    }

    // Return default if no settings exist
    const settings = data?.[0];
    return {
      userId,
      hidePhotosFromAllGroups: settings?.hide_photos_from_all_groups ?? false,
    };
  }

  async updateGlobalPhotoSettings(
    userId: string,
    hidePhotosFromAllGroups: boolean,
  ): Promise<GlobalPhotoSettings> {
    const { error } = await this.supabase.rpc(
      "update_user_photo_global_settings",
      {
        p_user_id: userId,
        p_hide_photos_from_all_groups: hidePhotosFromAllGroups,
      },
    );

    if (error) {
      throw new DatabaseError(
        `Failed to update global photo settings: ${error.message}`,
      );
    }

    return {
      userId,
      hidePhotosFromAllGroups,
    };
  }

  async getGroupPhotoSettings(
    userId: string,
    groupId: string,
  ): Promise<GroupPhotoSettings> {
    // Get group name
    const { data: group, error: groupError } = await this.supabase
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .single();

    if (groupError) {
      throw new DatabaseError(`Failed to fetch group: ${groupError.message}`);
    }

    const { data, error } = await this.supabase.rpc(
      "get_user_group_photo_settings",
      {
        p_user_id: userId,
        p_group_id: groupId,
      },
    );

    if (error) {
      throw new DatabaseError(
        `Failed to fetch group photo settings: ${error.message}`,
      );
    }

    // Return default if no settings exist
    const settings = data?.[0];
    return {
      userId,
      groupId,
      groupName: group?.name || "Unknown Group",
      hidePhotosFromGroup: settings?.hide_photos_from_group ?? false,
    };
  }

  async updateGroupPhotoSettings(
    userId: string,
    groupId: string,
    hidePhotosFromGroup: boolean,
  ): Promise<GroupPhotoSettings> {
    // Get group name
    const { data: group, error: groupError } = await this.supabase
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .single();

    if (groupError) {
      throw new DatabaseError(`Failed to fetch group: ${groupError.message}`);
    }

    const { error } = await this.supabase.rpc(
      "update_user_group_photo_settings",
      {
        p_user_id: userId,
        p_group_id: groupId,
        p_hide_photos_from_group: hidePhotosFromGroup,
      },
    );

    if (error) {
      throw new DatabaseError(
        `Failed to update group photo settings: ${error.message}`,
      );
    }

    return {
      userId,
      groupId,
      groupName: group?.name || "Unknown Group",
      hidePhotosFromGroup,
    };
  }

  async getAllGroupPhotoSettings(
    userId: string,
  ): Promise<GroupPhotoSettings[]> {
    // Get all groups the user is a member of
    const { data: memberships, error: membershipError } = await this.supabase
      .from("group_members")
      .select(
        `
        group_id,
        groups!inner(id, name)
      `,
      )
      .eq("user_id", userId);

    if (membershipError) {
      throw new DatabaseError(
        `Failed to fetch group memberships: ${membershipError.message}`,
      );
    }

    if (!memberships || memberships.length === 0) {
      return [];
    }

    // Get photo settings for each group via RPC
    const { data: settings, error: settingsError } = await this.supabase.rpc(
      "get_user_all_group_photo_settings",
      {
        p_user_id: userId,
      },
    );

    if (settingsError) {
      throw new DatabaseError(
        `Failed to fetch all group photo settings: ${settingsError.message}`,
      );
    }

    // Create a map of group_id -> settings
    const settingsMap = new Map<string, boolean>();
    for (const s of settings || []) {
      settingsMap.set(s.group_id, s.hide_photos_from_group);
    }

    // Combine memberships with settings
    return memberships.map((m: any) => ({
      userId,
      groupId: m.group_id,
      groupName: m.groups?.name || "Unknown Group",
      hidePhotosFromGroup: settingsMap.get(m.group_id) ?? false,
    }));
  }

  async updatePhotoVisibility(
    userId: string,
    photoId: string,
    visibility: PhotoVisibility,
  ): Promise<BeerPicture> {
    // Verify ownership
    const { data: photo, error: selectError } = await this.supabase
      .from("beer_pictures")
      .select("*")
      .eq("id", photoId)
      .eq("user_id", userId)
      .single();

    if (selectError || !photo) {
      throw new NotFoundError("Photo not found or access denied");
    }

    // Update visibility
    const { data, error } = await this.supabase
      .from("beer_pictures")
      .update({ visibility })
      .eq("id", photoId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw new DatabaseError(
        `Failed to update photo visibility: ${error.message}`,
      );
    }

    return this.mapToBeerPicture(data);
  }

  async bulkUpdatePhotoVisibility(
    userId: string,
    photoIds: string[],
    visibility: PhotoVisibility,
  ): Promise<number> {
    // First verify all photos belong to the user
    const { data: photos, error: selectError } = await this.supabase
      .from("beer_pictures")
      .select("id, user_id")
      .in("id", photoIds);

    if (selectError) {
      throw new DatabaseError(
        `Failed to verify photo ownership: ${selectError.message}`,
      );
    }

    // Check for unauthorized photos
    const unauthorizedPhotos =
      photos?.filter((p) => p.user_id !== userId) || [];
    if (unauthorizedPhotos.length > 0) {
      throw new ForbiddenError("Some photos do not belong to the current user");
    }

    // Update visibility for all photos
    const { error } = await this.supabase
      .from("beer_pictures")
      .update({ visibility })
      .in("id", photoIds)
      .eq("user_id", userId);

    if (error) {
      throw new DatabaseError(
        `Failed to update photos visibility: ${error.message}`,
      );
    }

    return photoIds.length;
  }
}
