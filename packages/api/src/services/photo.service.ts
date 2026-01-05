import { ErrorCodes } from "@prostcounter/shared/errors";

import type { IPhotoRepository } from "../repositories/interfaces";
import type {
  BeerPicture,
  GetPhotoUploadUrlQuery,
  GetPhotoUploadUrlResponse,
  GlobalPhotoSettings,
  GroupPhotoSettings,
  PhotoVisibility,
} from "@prostcounter/shared";

import { ValidationError } from "../middleware/error";

/**
 * Photo Service
 * Handles business logic for beer picture uploads
 */
export class PhotoService {
  // Allowed file types
  private readonly ALLOWED_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  // Max file size: 10MB
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  constructor(private photoRepo: IPhotoRepository) {}

  /**
   * Get signed upload URL for a photo
   *
   * Business Logic:
   * 1. Validate file type
   * 2. Validate file size
   * 3. Verify attendance exists and belongs to user
   * 4. Generate signed upload URL
   * 5. Pre-create database record
   *
   * @param userId - User ID uploading the photo
   * @param query - Upload parameters
   * @returns Upload URL, public URL, and picture ID
   */
  async getUploadUrl(
    userId: string,
    query: GetPhotoUploadUrlQuery,
  ): Promise<GetPhotoUploadUrlResponse> {
    // Validate file type
    if (!this.ALLOWED_TYPES.includes(query.fileType)) {
      throw new ValidationError(ErrorCodes.INVALID_FILE_TYPE);
    }

    // Validate file size
    if (query.fileSize > this.MAX_FILE_SIZE) {
      throw new ValidationError(ErrorCodes.FILE_TOO_LARGE);
    }

    // Validate file name
    if (query.fileName.length > 255) {
      throw new ValidationError(ErrorCodes.FILE_NAME_TOO_LONG);
    }

    // Generate upload URL (repository handles attendance verification)
    return this.photoRepo.getUploadUrl(userId, query);
  }

  /**
   * Confirm photo upload was successful
   *
   * @param pictureId - Beer picture ID
   * @param userId - User ID (for authorization)
   * @returns Confirmed picture data
   */
  async confirmUpload(pictureId: string, userId: string): Promise<BeerPicture> {
    return this.photoRepo.confirmUpload(pictureId, userId);
  }

  /**
   * Get photos for an attendance
   *
   * @param attendanceId - Attendance ID
   * @param userId - User ID (for authorization)
   * @returns Array of beer pictures
   */
  async getPhotosForAttendance(
    attendanceId: string,
    userId: string,
  ): Promise<BeerPicture[]> {
    return this.photoRepo.findByAttendance(attendanceId, userId);
  }

  /**
   * List photos for a user
   *
   * @param userId - User ID
   * @param festivalId - Optional festival filter
   * @param limit - Max results
   * @param offset - Pagination offset
   * @returns Photos and total count
   */
  async listPhotos(
    userId: string,
    festivalId?: string,
    limit = 50,
    offset = 0,
  ): Promise<{ data: BeerPicture[]; total: number }> {
    // Validate pagination
    if (limit < 1 || limit > 100) {
      throw new ValidationError(ErrorCodes.INVALID_PAGINATION);
    }

    if (offset < 0) {
      throw new ValidationError(ErrorCodes.INVALID_PAGINATION);
    }

    return this.photoRepo.list(userId, festivalId, limit, offset);
  }

  /**
   * Delete a photo
   *
   * Business Logic:
   * 1. Verify photo exists and belongs to user
   * 2. Delete from storage
   * 3. Delete database record
   *
   * @param pictureId - Picture ID
   * @param userId - User ID (for authorization)
   */
  async deletePhoto(pictureId: string, userId: string): Promise<void> {
    await this.photoRepo.delete(pictureId, userId);

    // TODO: Invalidate wrapped cache if this affects stats
    // await this.wrappedService.invalidateCache(userId);
  }

  /**
   * Update photo caption
   * Note: Current schema doesn't support captions yet
   *
   * @param pictureId - Picture ID
   * @param userId - User ID (for authorization)
   * @param caption - New caption text
   * @returns Updated picture
   */
  async updateCaption(
    pictureId: string,
    userId: string,
    caption: string,
  ): Promise<BeerPicture> {
    // Validate caption length
    if (caption.length > 500) {
      throw new ValidationError(ErrorCodes.CAPTION_TOO_LONG);
    }

    return this.photoRepo.updateCaption(pictureId, userId, caption);
  }

  // ===== Photo Privacy Settings =====

  /**
   * Get user's global photo settings
   *
   * @param userId - User ID
   * @returns Global photo settings
   */
  async getGlobalPhotoSettings(userId: string): Promise<GlobalPhotoSettings> {
    return this.photoRepo.getGlobalPhotoSettings(userId);
  }

  /**
   * Update user's global photo settings
   *
   * @param userId - User ID
   * @param hidePhotosFromAllGroups - Whether to hide photos from all groups
   * @returns Updated settings
   */
  async updateGlobalPhotoSettings(
    userId: string,
    hidePhotosFromAllGroups: boolean,
  ): Promise<GlobalPhotoSettings> {
    return this.photoRepo.updateGlobalPhotoSettings(
      userId,
      hidePhotosFromAllGroups,
    );
  }

  /**
   * Get user's photo settings for a specific group
   *
   * @param userId - User ID
   * @param groupId - Group ID
   * @returns Group photo settings
   */
  async getGroupPhotoSettings(
    userId: string,
    groupId: string,
  ): Promise<GroupPhotoSettings> {
    return this.photoRepo.getGroupPhotoSettings(userId, groupId);
  }

  /**
   * Update user's photo settings for a specific group
   *
   * @param userId - User ID
   * @param groupId - Group ID
   * @param hidePhotosFromGroup - Whether to hide photos from this group
   * @returns Updated settings
   */
  async updateGroupPhotoSettings(
    userId: string,
    groupId: string,
    hidePhotosFromGroup: boolean,
  ): Promise<GroupPhotoSettings> {
    return this.photoRepo.updateGroupPhotoSettings(
      userId,
      groupId,
      hidePhotosFromGroup,
    );
  }

  /**
   * Get all user's group photo settings
   *
   * @param userId - User ID
   * @returns Array of group photo settings
   */
  async getAllGroupPhotoSettings(
    userId: string,
  ): Promise<GroupPhotoSettings[]> {
    return this.photoRepo.getAllGroupPhotoSettings(userId);
  }

  /**
   * Update visibility for a single photo
   *
   * @param userId - User ID
   * @param photoId - Photo ID
   * @param visibility - New visibility setting
   * @returns Updated photo
   */
  async updatePhotoVisibility(
    userId: string,
    photoId: string,
    visibility: PhotoVisibility,
  ): Promise<BeerPicture> {
    // Repository handles ownership verification
    return this.photoRepo.updatePhotoVisibility(userId, photoId, visibility);
  }

  /**
   * Bulk update visibility for multiple photos
   *
   * @param userId - User ID
   * @param photoIds - Array of photo IDs
   * @param visibility - New visibility setting
   * @returns Number of photos updated
   */
  async bulkUpdatePhotoVisibility(
    userId: string,
    photoIds: string[],
    visibility: PhotoVisibility,
  ): Promise<number> {
    // Repository handles ownership verification
    return this.photoRepo.bulkUpdatePhotoVisibility(
      userId,
      photoIds,
      visibility,
    );
  }
}
