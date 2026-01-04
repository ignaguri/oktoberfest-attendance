import { z } from "zod";

export const createGroupSchema = z.object({
  groupName: z.string().min(1, "Group name is required").trim(),
  password: z.string().min(1, "Password is required").trim(),
});

export const joinGroupSchema = z.object({
  groupName: z.string().min(1, "Group name is required").trim(),
  password: z.string().min(1, "Password is required").trim(),
});

export const groupSettingsSchema = z.object({
  name: z.string().min(1, "Group name is required").trim(),
  description: z.string().optional(),
  winning_criteria_id: z.number().min(1, "Winning criteria is required"),
});

export type CreateGroupFormData = z.infer<typeof createGroupSchema>;
export type JoinGroupFormData = z.infer<typeof joinGroupSchema>;
export type GroupSettingsFormData = z.infer<typeof groupSettingsSchema>;
