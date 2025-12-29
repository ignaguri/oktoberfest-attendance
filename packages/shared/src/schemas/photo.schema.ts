import { z } from "zod";

/**
 * Photo upload URL request
 * GET /api/v1/photos/upload-url
 */
export const GetPhotoUploadUrlQuerySchema = z.object({
  festivalId: z.string().uuid("Invalid festival ID"),
  attendanceId: z.string().uuid("Invalid attendance ID"),
  fileName: z.string().min(1, "File name is required"),
  fileType: z.string().min(1, "File type is required").regex(/^image\/(jpeg|jpg|png|webp|gif)$/, "Must be an image file"),
  fileSize: z.coerce.number().int().min(1).max(10 * 1024 * 1024, "File size must not exceed 10MB"), // 10MB max
});

export type GetPhotoUploadUrlQuery = z.infer<typeof GetPhotoUploadUrlQuerySchema>;

/**
 * Photo upload URL response
 */
export const GetPhotoUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  publicUrl: z.string().url(),
  expiresIn: z.number().int(), // Seconds until upload URL expires
  pictureId: z.string().uuid(), // Pre-created beer_pictures record ID
});

export type GetPhotoUploadUrlResponse = z.infer<typeof GetPhotoUploadUrlResponseSchema>;

/**
 * Confirm photo upload request
 * POST /api/v1/photos/:id/confirm
 */
export const ConfirmPhotoUploadSchema = z.object({
  pictureId: z.string().uuid("Invalid picture ID"),
});

export type ConfirmPhotoUploadInput = z.infer<typeof ConfirmPhotoUploadSchema>;

/**
 * Confirm photo upload response
 */
export const ConfirmPhotoUploadResponseSchema = z.object({
  success: z.boolean(),
  picture: z.object({
    id: z.string().uuid(),
    url: z.string().url(),
    attendanceId: z.string().uuid(),
    uploadedAt: z.string().datetime(),
  }),
});

export type ConfirmPhotoUploadResponse = z.infer<typeof ConfirmPhotoUploadResponseSchema>;

/**
 * Photo visibility enum
 */
export const PhotoVisibilitySchema = z.enum(["public", "private"]);

export type PhotoVisibility = z.infer<typeof PhotoVisibilitySchema>;

/**
 * Beer picture schema
 */
export const BeerPictureSchema = z.object({
  id: z.string().uuid(),
  attendanceId: z.string().uuid(),
  userId: z.string().uuid(),
  pictureUrl: z.string().url(),
  visibility: PhotoVisibilitySchema,
  createdAt: z.string().datetime(),
});

export type BeerPicture = z.infer<typeof BeerPictureSchema>;

/**
 * Get photos for attendance
 * GET /api/v1/photos
 */
export const GetPhotosQuerySchema = z.object({
  attendanceId: z.string().uuid("Invalid attendance ID").optional(),
  festivalId: z.string().uuid("Invalid festival ID").optional(),
  userId: z.string().uuid("Invalid user ID").optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type GetPhotosQuery = z.infer<typeof GetPhotosQuerySchema>;

/**
 * Get photos response
 */
export const GetPhotosResponseSchema = z.object({
  photos: z.array(BeerPictureSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

export type GetPhotosResponse = z.infer<typeof GetPhotosResponseSchema>;
