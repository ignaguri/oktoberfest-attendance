import { z } from "zod";

const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12MB
const VALID_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_PICTURES = 10;

export const beerPicturesSchema = z.object({
  pictures: z
    .array(
      z
        .instanceof(File)
        .refine((file) => file.size <= MAX_FILE_SIZE, {
          message: "File is too large (max 12MB)",
        })
        .refine((file) => VALID_FILE_TYPES.includes(file.type), {
          message: "Unsupported file format (use JPEG, PNG, GIF, or WebP)",
        }),
    )
    .min(1, "At least one picture is required")
    .max(MAX_PICTURES, `Maximum ${MAX_PICTURES} pictures allowed`),
});

export const singlePictureSchema = z.object({
  picture: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: "File is too large (max 12MB)",
    })
    .refine((file) => VALID_FILE_TYPES.includes(file.type), {
      message: "Unsupported file format (use JPEG, PNG, GIF, or WebP)",
    }),
});

export const avatarSchema = z.object({
  avatar: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: "File is too large (max 12MB)",
    })
    .refine((file) => VALID_FILE_TYPES.includes(file.type), {
      message: "Unsupported file format (use JPEG, PNG, GIF, or WebP)",
    }),
});

export type BeerPicturesFormData = z.infer<typeof beerPicturesSchema>;
export type SinglePictureFormData = z.infer<typeof singlePictureSchema>;
export type AvatarFormData = z.infer<typeof avatarSchema>;
