import { z } from "zod";

/**
 * Photo upload URL request
 * GET /api/v1/photos/upload-url
 */
export const GetPhotoUploadUrlQuerySchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  attendanceId: z.uuid({ error: "Invalid attendance ID" }),
  fileName: z.string().min(1, "File name is required"),
  fileType: z.string().min(1, "File type is required").regex(/^image\/(jpeg|jpg|png|webp|gif)$/, "Must be an image file"),
  fileSize: z.coerce.number().int().min(1).max(10 * 1024 * 1024, "File size must not exceed 10MB"), // 10MB max
});

export type GetPhotoUploadUrlQuery = z.infer<typeof GetPhotoUploadUrlQuerySchema>;

/**
 * Photo upload URL response
 */
export const GetPhotoUploadUrlResponseSchema = z.object({
  uploadUrl: z.url(),
  publicUrl: z.url(),
  expiresIn: z.number().int(), // Seconds until upload URL expires
  pictureId: z.uuid(), // Pre-created beer_pictures record ID
});

export type GetPhotoUploadUrlResponse = z.infer<typeof GetPhotoUploadUrlResponseSchema>;

/**
 * Confirm photo upload request
 * POST /api/v1/photos/:id/confirm
 */
export const ConfirmPhotoUploadSchema = z.object({
  pictureId: z.uuid({ error: "Invalid picture ID" }),
});

export type ConfirmPhotoUploadInput = z.infer<typeof ConfirmPhotoUploadSchema>;

/**
 * Confirm photo upload response
 */
export const ConfirmPhotoUploadResponseSchema = z.object({
  success: z.boolean(),
  picture: z.object({
    id: z.uuid(),
    url: z.url(),
    attendanceId: z.uuid(),
    uploadedAt: z.iso.datetime(),
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
  id: z.uuid(),
  attendanceId: z.uuid(),
  userId: z.uuid(),
  pictureUrl: z.url(),
  visibility: PhotoVisibilitySchema,
  createdAt: z.iso.datetime(),
});

export type BeerPicture = z.infer<typeof BeerPictureSchema>;

/**
 * Get photos for attendance
 * GET /api/v1/photos
 */
export const GetPhotosQuerySchema = z.object({
  attendanceId: z.uuid({ error: "Invalid attendance ID" }).optional(),
  festivalId: z.uuid({ error: "Invalid festival ID" }).optional(),
  userId: z.uuid({ error: "Invalid user ID" }).optional(),
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

// ===== Photo Privacy Settings =====

/**
 * Global photo settings schema
 */
export const GlobalPhotoSettingsSchema = z.object({
  userId: z.uuid(),
  hidePhotosFromAllGroups: z.boolean(),
});

export type GlobalPhotoSettings = z.infer<typeof GlobalPhotoSettingsSchema>;

/**
 * Update global photo settings request
 */
export const UpdateGlobalPhotoSettingsSchema = z.object({
  hidePhotosFromAllGroups: z.boolean(),
});

export type UpdateGlobalPhotoSettingsInput = z.infer<typeof UpdateGlobalPhotoSettingsSchema>;

/**
 * Group photo settings schema
 */
export const GroupPhotoSettingsSchema = z.object({
  userId: z.uuid(),
  groupId: z.uuid(),
  groupName: z.string(),
  hidePhotosFromGroup: z.boolean(),
});

export type GroupPhotoSettings = z.infer<typeof GroupPhotoSettingsSchema>;

/**
 * Update group photo settings request
 */
export const UpdateGroupPhotoSettingsSchema = z.object({
  groupId: z.uuid(),
  hidePhotosFromGroup: z.boolean(),
});

export type UpdateGroupPhotoSettingsInput = z.infer<typeof UpdateGroupPhotoSettingsSchema>;

/**
 * Update photo visibility request
 */
export const UpdatePhotoVisibilitySchema = z.object({
  visibility: PhotoVisibilitySchema,
});

export type UpdatePhotoVisibilityInput = z.infer<typeof UpdatePhotoVisibilitySchema>;

/**
 * Bulk update photo visibility request
 */
export const BulkUpdatePhotoVisibilitySchema = z.object({
  photoIds: z.array(z.uuid()).min(1, "At least one photo ID is required"),
  visibility: PhotoVisibilitySchema,
});

export type BulkUpdatePhotoVisibilityInput = z.infer<typeof BulkUpdatePhotoVisibilitySchema>;
