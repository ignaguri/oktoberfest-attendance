import type {
  BeerPicture,
  GetPhotoUploadUrlQuery,
  GetPhotoUploadUrlResponse,
  GlobalPhotoSettings,
  GroupPhotoSettings,
  PhotoVisibility,
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
    query: GetPhotoUploadUrlQuery,
  ): Promise<GetPhotoUploadUrlResponse>;

  /**
   * Confirm photo upload was successful
   * @param pictureId - Beer picture ID
   * @param userId - User ID (for authorization)
   * @returns Confirmed picture data
   */
  confirmUpload(pictureId: string, userId: string): Promise<BeerPicture>;

  /**
   * Get photos for an attendance
   * @param attendanceId - Attendance ID
   * @param userId - User ID (for authorization)
   * @returns Array of beer pictures
   */
  findByAttendance(
    attendanceId: string,
    userId: string,
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
    offset?: number,
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
    caption: string,
  ): Promise<BeerPicture>;

  // ===== Photo Privacy Settings =====

  /**
   * Get user's global photo settings
   * @param userId - User ID
   * @returns Global photo settings
   */
  getGlobalPhotoSettings(userId: string): Promise<GlobalPhotoSettings>;

  /**
   * Update user's global photo settings
   * @param userId - User ID
   * @param hidePhotosFromAllGroups - Whether to hide photos from all groups
   * @returns Updated settings
   */
  updateGlobalPhotoSettings(
    userId: string,
    hidePhotosFromAllGroups: boolean,
  ): Promise<GlobalPhotoSettings>;

  /**
   * Get user's photo settings for a specific group
   * @param userId - User ID
   * @param groupId - Group ID
   * @returns Group photo settings
   */
  getGroupPhotoSettings(
    userId: string,
    groupId: string,
  ): Promise<GroupPhotoSettings>;

  /**
   * Update user's photo settings for a specific group
   * @param userId - User ID
   * @param groupId - Group ID
   * @param hidePhotosFromGroup - Whether to hide photos from this group
   * @returns Updated settings
   */
  updateGroupPhotoSettings(
    userId: string,
    groupId: string,
    hidePhotosFromGroup: boolean,
  ): Promise<GroupPhotoSettings>;

  /**
   * Get all user's group photo settings
   * @param userId - User ID
   * @returns Array of group photo settings
   */
  getAllGroupPhotoSettings(userId: string): Promise<GroupPhotoSettings[]>;

  /**
   * Update visibility for a single photo
   * @param userId - User ID
   * @param photoId - Photo ID
   * @param visibility - New visibility setting
   * @returns Updated photo
   */
  updatePhotoVisibility(
    userId: string,
    photoId: string,
    visibility: PhotoVisibility,
  ): Promise<BeerPicture>;

  /**
   * Bulk update visibility for multiple photos
   * @param userId - User ID
   * @param photoIds - Array of photo IDs
   * @param visibility - New visibility setting
   * @returns Number of photos updated
   */
  bulkUpdatePhotoVisibility(
    userId: string,
    photoIds: string[],
    visibility: PhotoVisibility,
  ): Promise<number>;
}
