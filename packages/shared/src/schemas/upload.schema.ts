import { z } from "zod";

/**
 * Upload constants shared across web and mobile
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE_MB = 10;
export const MAX_PICTURES = 10;
export const VALID_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type ValidImageType = (typeof VALID_IMAGE_TYPES)[number];

/**
 * File metadata schema for mobile (React Native doesn't have browser File API)
 * Use this when you have file metadata but not the actual File object
 */
export type FileMetadata = z.infer<typeof FileMetadataSchema>;
export const FileMetadataSchema = z.object({
  uri: z.string().min(1, { error: "validation.file.required" }),
  size: z
    .number()
    .max(MAX_FILE_SIZE, { error: "validation.file.tooLarge" }),
  mimeType: z.enum(VALID_IMAGE_TYPES, { error: "validation.file.invalidType" }),
  name: z.string().optional(),
});

/**
 * Multiple files metadata schema
 */
export type MultipleFilesMetadata = z.infer<typeof MultipleFilesMetadataSchema>;
export const MultipleFilesMetadataSchema = z.object({
  files: z
    .array(FileMetadataSchema)
    .min(1, { error: "validation.file.required" })
    .max(MAX_PICTURES, { error: "validation.file.tooMany" }),
  visibility: z.enum(["public", "private"]),
});

/**
 * Single file metadata schema with visibility
 */
export type SingleFileMetadata = z.infer<typeof SingleFileMetadataSchema>;
export const SingleFileMetadataSchema = z.object({
  file: FileMetadataSchema,
  visibility: z.enum(["public", "private"]),
});

/**
 * Avatar file metadata schema (no visibility needed)
 */
export type AvatarFileMetadata = z.infer<typeof AvatarFileMetadataSchema>;
export const AvatarFileMetadataSchema = z.object({
  file: FileMetadataSchema,
});
