import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MB,
  MAX_PICTURES,
  VALID_IMAGE_TYPES,
} from "@prostcounter/shared/schemas";
import { z } from "zod";

// Re-export constants for consumers that import from here
export { MAX_FILE_SIZE, MAX_PICTURES };

/**
 * Web-specific upload schemas using browser File API
 * For mobile, use FileMetadataSchema from @prostcounter/shared/schemas
 */

export const beerPicturesSchema = z.object({
  pictures: z
    .array(
      z
        .instanceof(File)
        .refine((file) => file.size <= MAX_FILE_SIZE, {
          message: `File is too large (max ${MAX_FILE_SIZE_MB}MB)`,
        })
        .refine(
          (file) =>
            (VALID_IMAGE_TYPES as readonly string[]).includes(file.type),
          {
            message: "Unsupported file format (use JPEG, PNG, GIF, or WebP)",
          },
        ),
    )
    .min(1, "At least one picture is required")
    .max(MAX_PICTURES, `Maximum ${MAX_PICTURES} pictures allowed`),
  visibility: z.enum(["public", "private"]),
});

export const singlePictureSchema = z.object({
  picture: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: `File is too large (max ${MAX_FILE_SIZE_MB}MB)`,
    })
    .refine(
      (file) => (VALID_IMAGE_TYPES as readonly string[]).includes(file.type),
      {
        message: "Unsupported file format (use JPEG, PNG, GIF, or WebP)",
      },
    ),
  visibility: z.enum(["public", "private"]),
});

export const avatarSchema = z.object({
  avatar: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: `File is too large (max ${MAX_FILE_SIZE_MB}MB)`,
    })
    .refine(
      (file) => (VALID_IMAGE_TYPES as readonly string[]).includes(file.type),
      {
        message: "Unsupported file format (use JPEG, PNG, GIF, or WebP)",
      },
    ),
});

export type BeerPicturesFormData = z.infer<typeof beerPicturesSchema>;
export type SinglePictureFormData = z.infer<typeof singlePictureSchema>;
export type AvatarFormData = z.infer<typeof avatarSchema>;
