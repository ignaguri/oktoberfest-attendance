import type { Database } from "@prostcounter/db";
import type { PhotoTaggedUser } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";
import type { IPhotoTagRepository, PhotoTagTarget, TaggedPhotoRow } from "../interfaces";

export class SupabasePhotoTagRepository implements IPhotoTagRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getPhotoTarget(photoId: string): Promise<PhotoTagTarget | null> {
    const { data, error } = await this.supabase
      .from("beer_pictures")
      .select("id, user_id, visibility, attendances!inner(festival_id)")
      .eq("id", photoId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to fetch photo: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    return {
      photoId: data.id,
      uploaderId: data.user_id,
      visibility: data.visibility,
      festivalId: data.attendances.festival_id,
    };
  }

  async listTaggedUserIds(photoId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("photo_tags")
      .select("tagged_user_id")
      .eq("photo_id", photoId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new DatabaseError(`Failed to list photo tags: ${error.message}`);
    }

    return (data ?? []).map((row) => row.tagged_user_id);
  }

  async replaceTags(photoId: string, userIds: string[]): Promise<string[]> {
    // One statement, so a rejected insert cannot leave the old tags deleted
    const { data, error } = await this.supabase.rpc("set_photo_tags", {
      p_photo_id: photoId,
      p_user_ids: userIds,
    });

    if (error) {
      throw new DatabaseError(`Failed to set photo tags: ${error.message}`);
    }

    return data ?? [];
  }

  async getTaggedUsers(photoId: string): Promise<PhotoTaggedUser[]> {
    const userIds = await this.listTaggedUserIds(photoId);
    const profiles = await this.getProfiles(userIds);
    const profileById = new Map(profiles.map((profile) => [profile.userId, profile]));

    // Keep tag order; a profile the caller cannot read still shows as a bare id
    return userIds.map(
      (userId) =>
        profileById.get(userId) ?? { userId, username: null, fullName: null, avatarUrl: null },
    );
  }

  async listTaggedPhotos(
    userId: string,
    festivalId: string,
    limit: number,
  ): Promise<TaggedPhotoRow[]> {
    const { data, error } = await this.supabase
      .from("photo_tags")
      .select(
        "created_at, beer_pictures!inner(id, user_id, picture_url, created_at, visibility, attendances!inner(festival_id))",
      )
      .eq("tagged_user_id", userId)
      .eq("beer_pictures.visibility", "public")
      .eq("beer_pictures.attendances.festival_id", festivalId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new DatabaseError(`Failed to list tagged photos: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      id: row.beer_pictures.id,
      pictureUrl: row.beer_pictures.picture_url,
      createdAt: row.beer_pictures.created_at,
      uploaderId: row.beer_pictures.user_id,
    }));
  }

  async getProfiles(userIds: string[]): Promise<PhotoTaggedUser[]> {
    if (userIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", userIds);

    if (error) {
      throw new DatabaseError(`Failed to fetch profiles: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      userId: row.id,
      username: row.username,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
    }));
  }

  async findSharedGroupIds(
    viewerId: string,
    userIds: string[],
    festivalId: string,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const uploaderIds = userIds.filter((userId) => userId !== viewerId);
    if (uploaderIds.length === 0) {
      return result;
    }

    // feed_photo_gallery_groups answers for the calling viewer only, and skips
    // groups the uploader hid their photos from, so the gallery it opens
    // actually shows the photo. One call covers every uploader.
    const { data, error } = await this.supabase.rpc("feed_photo_gallery_groups", {
      p_uploader_ids: uploaderIds,
      p_festival_id: festivalId,
    });

    if (error) {
      throw new DatabaseError(`Failed to find shared groups: ${error.message}`);
    }

    for (const row of data ?? []) {
      if (row.group_id) {
        result.set(row.uploader_id, row.group_id);
      }
    }

    return result;
  }
}
