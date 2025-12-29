import type {
  BeerPicture,
  GetPhotoUploadUrlQuery,
  GetPhotoUploadUrlResponse,
} from "@prostcounter/shared";
import type { IPhotoRepository } from "../repositories/interfaces";
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
    query: GetPhotoUploadUrlQuery
  ): Promise<GetPhotoUploadUrlResponse> {
    // Validate file type
    if (!this.ALLOWED_TYPES.includes(query.fileType)) {
      throw new ValidationError(
        `Invalid file type. Allowed types: ${this.ALLOWED_TYPES.join(", ")}`
      );
    }

    // Validate file size
    if (query.fileSize > this.MAX_FILE_SIZE) {
      throw new ValidationError(
        `File size exceeds maximum of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    // Validate file name
    if (query.fileName.length > 255) {
      throw new ValidationError("File name too long (max 255 characters)");
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
  async confirmUpload(
    pictureId: string,
    userId: string
  ): Promise<BeerPicture> {
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
    userId: string
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
    offset = 0
  ): Promise<{ data: BeerPicture[]; total: number }> {
    // Validate pagination
    if (limit < 1 || limit > 100) {
      throw new ValidationError("Limit must be between 1 and 100");
    }

    if (offset < 0) {
      throw new ValidationError("Offset must be non-negative");
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
    caption: string
  ): Promise<BeerPicture> {
    // Validate caption length
    if (caption.length > 500) {
      throw new ValidationError("Caption too long (max 500 characters)");
    }

    return this.photoRepo.updateCaption(pictureId, userId, caption);
  }
}
