import { z } from "zod";

export const profileSchema = z.object({
  full_name: z.string().optional(),
  username: z.string().min(1, "Username is required").trim(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  custom_beer_cost: z.number().min(0, "Beer cost cannot be negative").optional(),
});

export const uploadAvatarSchema = z.object({
  avatar: z.instanceof(File).refine(
    (file) => file.size <= 5 * 1024 * 1024, // 5MB
    "File size must be less than 5MB"
  ).refine(
    (file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    "File must be a JPEG, PNG, or WebP image"
  ),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
export type UploadAvatarFormData = z.infer<typeof uploadAvatarSchema>;