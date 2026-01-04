import type { IPhotoRepository } from "../interfaces/photo.repository";
import type { Database } from "@prostcounter/db";
import type {
  BeerPicture,
  GetPhotoUploadUrlQuery,
  GetPhotoUploadUrlResponse,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DatabaseError,
  NotFoundError,
  ForbiddenError,
} from "../../middleware/error";

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

    // Get public URL for the file
    const { data: publicUrlData } = this.supabase.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(filePath);

    // Pre-create beer_pictures record
    const { data: picture, error: pictureError } = await this.supabase
      .from("beer_pictures")
      .insert({
        user_id: userId,
        attendance_id: query.attendanceId,
        picture_url: publicUrlData.publicUrl,
        visibility: "private", // Default to private
      })
      .select()
      .single();

    if (pictureError) {
      throw new DatabaseError(
        `Failed to create picture record: ${pictureError.message}`,
      );
    }

    return {
      uploadUrl: uploadData.signedUrl,
      publicUrl: publicUrlData.publicUrl,
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

    // Extract file path from URL
    const url = new URL(data.picture_url);
    const pathParts = url.pathname.split("/");
    const filePath = pathParts
      .slice(pathParts.indexOf(this.BUCKET_NAME) + 1)
      .join("/");

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
    return {
      id: data.id,
      userId: data.user_id,
      attendanceId: data.attendance_id,
      pictureUrl: data.picture_url,
      visibility: data.visibility,
      createdAt: data.created_at,
    };
  }
}
