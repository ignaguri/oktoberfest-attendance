import { z } from "zod";

export const photoVisibilitySchema = z.object({
  visibility: z.enum(["public", "private"]).default("public"),
});

export const globalPhotoSettingsSchema = z.object({
  hide_photos_from_all_groups: z.boolean().default(false),
});

export const groupPhotoSettingsSchema = z.object({
  group_id: z.string().uuid(),
  hide_photos_from_group: z.boolean().default(false),
});

export const bulkPhotoVisibilitySchema = z.object({
  photo_ids: z.array(z.string().uuid()).min(1, "Select at least one photo"),
  visibility: z.enum(["public", "private"]),
});

export type PhotoVisibilityFormData = z.infer<typeof photoVisibilitySchema>;
export type GlobalPhotoSettingsFormData = z.infer<
  typeof globalPhotoSettingsSchema
>;
export type GroupPhotoSettingsFormData = z.infer<
  typeof groupPhotoSettingsSchema
>;
export type BulkPhotoVisibilityFormData = z.infer<
  typeof bulkPhotoVisibilitySchema
>;
