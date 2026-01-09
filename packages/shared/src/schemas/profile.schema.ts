import { z } from "zod";

// Profile schemas
export const ProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  full_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  tutorial_completed: z.boolean().nullable(),
  tutorial_completed_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileShortSchema = z.object({
  full_name: z.string().nullable(),
  username: z.string().nullable(),
  avatar_url: z.string().nullable(),
  preferred_language: z.string().nullable(),
  email: z.string().nullable().optional(),
});

export type ProfileShort = z.infer<typeof ProfileShortSchema>;

// Update profile schema
export const UpdateProfileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  full_name: z.string().min(1).max(100).optional(),
  preferred_language: z
    .string()
    .nullable()
    .refine(
      (val) => val === null || ["en"].includes(val),
      "Invalid language code",
    )
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// Response schemas
export const GetProfileResponseSchema = z.object({
  profile: ProfileSchema,
});

export const GetProfileShortResponseSchema = z.object({
  profile: ProfileShortSchema,
});

export const UpdateProfileResponseSchema = z.object({
  profile: ProfileSchema,
});

export const DeleteProfileResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Tutorial status
export const TutorialStatusSchema = z.object({
  tutorial_completed: z.boolean(),
  tutorial_completed_at: z.string().nullable(),
});

export type TutorialStatus = z.infer<typeof TutorialStatusSchema>;

export const GetTutorialStatusResponseSchema = z.object({
  status: TutorialStatusSchema,
});

export const UpdateTutorialStatusResponseSchema = z.object({
  success: z.boolean(),
});

// Missing profile fields
export const MissingProfileFieldsSchema = z.object({
  username: z.boolean(),
  full_name: z.boolean(),
  avatar_url: z.boolean(),
});

export type MissingProfileFields = z.infer<typeof MissingProfileFieldsSchema>;

export const GetMissingProfileFieldsResponseSchema = z.object({
  missingFields: MissingProfileFieldsSchema,
  hasMissingFields: z.boolean(),
});

// Highlights (user stats for home page)
export const HighlightsSchema = z.object({
  totalBeers: z.number(),
  totalDays: z.number(),
  totalSpent: z.number(),
  avgBeersPerDay: z.number(),
  favoriteDay: z.string().nullable(),
  favoriteTent: z.string().nullable(),
  groupPositions: z.array(
    z.object({
      groupId: z.string(),
      groupName: z.string(),
      position: z.number(),
      totalMembers: z.number(),
    }),
  ),
});

export type Highlights = z.infer<typeof HighlightsSchema>;

export const GetHighlightsResponseSchema = z.object({
  highlights: HighlightsSchema,
});

// Avatar upload schemas
export const GetAvatarUploadUrlQuerySchema = z.object({
  fileName: z.string().min(1),
  fileType: z
    .string()
    .regex(/^image\/(jpeg|png|webp|gif)$/, "Invalid image type"),
  fileSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024), // Max 10MB
});

export type GetAvatarUploadUrlQuery = z.infer<
  typeof GetAvatarUploadUrlQuerySchema
>;

export const GetAvatarUploadUrlResponseSchema = z.object({
  uploadUrl: z.url(),
  fileName: z.string(), // The unique filename to use for confirmation
  expiresIn: z.number().int(),
});

export type GetAvatarUploadUrlResponse = z.infer<
  typeof GetAvatarUploadUrlResponseSchema
>;

export const ConfirmAvatarUploadSchema = z.object({
  fileName: z.string().min(1), // Just the filename, not the full URL
});

export type ConfirmAvatarUploadInput = z.infer<
  typeof ConfirmAvatarUploadSchema
>;

export const ConfirmAvatarUploadResponseSchema = z.object({
  success: z.boolean(),
  fileName: z.string(), // Returns the filename stored in the database
});
