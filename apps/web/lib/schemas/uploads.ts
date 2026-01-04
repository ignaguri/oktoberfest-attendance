import { z } from "zod";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_PICTURES = 10;
const VALID_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export const beerPicturesSchema = z.object({
  pictures: z
    .array(
      z
        .instanceof(File)
        .refine((file) => file.size <= MAX_FILE_SIZE, {
          message: `File is too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
        })
        .refine((file) => VALID_FILE_TYPES.includes(file.type), {
          message: "Unsupported file format (use JPEG, PNG, GIF, or WebP)",
        }),
    )
    .min(1, "At least one picture is required")
    .max(MAX_PICTURES, `Maximum ${MAX_PICTURES} pictures allowed`),
  visibility: z.enum(["public", "private"]),
});

export const singlePictureSchema = z.object({
  picture: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: `File is too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
    })
    .refine((file) => VALID_FILE_TYPES.includes(file.type), {
      message: "Unsupported file format (use JPEG, PNG, GIF, or WebP)",
    }),
  visibility: z.enum(["public", "private"]),
});

export const avatarSchema = z.object({
  avatar: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: `File is too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
    })
    .refine((file) => VALID_FILE_TYPES.includes(file.type), {
      message: "Unsupported file format (use JPEG, PNG, GIF, or WebP)",
    }),
});

export type BeerPicturesFormData = z.infer<typeof beerPicturesSchema>;
export type SinglePictureFormData = z.infer<typeof singlePictureSchema>;
export type AvatarFormData = z.infer<typeof avatarSchema>;
