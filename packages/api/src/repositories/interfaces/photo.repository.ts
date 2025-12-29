import type {
  BeerPicture,
  GetPhotoUploadUrlQuery,
  GetPhotoUploadUrlResponse,
} from "@prostcounter/shared";

/**
 * Photo repository interface
 * Provides data access for beer pictures and photo uploads
 */
export interface IPhotoRepository {
  /**
   * Generate signed upload URL for a photo
   * @param userId - User ID uploading the photo
   * @param query - Upload parameters
   * @returns Upload URL, public URL, and picture ID
   */
  getUploadUrl(
    userId: string,
    query: GetPhotoUploadUrlQuery
  ): Promise<GetPhotoUploadUrlResponse>;

  /**
   * Confirm photo upload was successful
   * @param pictureId - Beer picture ID
   * @param userId - User ID (for authorization)
   * @returns Confirmed picture data
   */
  confirmUpload(
    pictureId: string,
    userId: string
  ): Promise<BeerPicture>;

  /**
   * Get photos for an attendance
   * @param attendanceId - Attendance ID
   * @param userId - User ID (for authorization)
   * @returns Array of beer pictures
   */
  findByAttendance(
    attendanceId: string,
    userId: string
  ): Promise<BeerPicture[]>;

  /**
   * List photos for a user
   * @param userId - User ID
   * @param festivalId - Optional festival filter
   * @param limit - Max results
   * @param offset - Pagination offset
   * @returns Photos and total count
   */
  list(
    userId: string,
    festivalId?: string,
    limit?: number,
    offset?: number
  ): Promise<{ data: BeerPicture[]; total: number }>;

  /**
   * Delete a photo
   * @param pictureId - Picture ID
   * @param userId - User ID (for authorization)
   */
  delete(pictureId: string, userId: string): Promise<void>;

  /**
   * Update photo caption
   * @param pictureId - Picture ID
   * @param userId - User ID (for authorization)
   * @param caption - New caption text
   * @returns Updated picture
   */
  updateCaption(
    pictureId: string,
    userId: string,
    caption: string
  ): Promise<BeerPicture>;
}
