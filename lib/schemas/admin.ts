import { z } from "zod";

export const groupSchema = z.object({
  name: z.string().min(1, "Required").trim(),
  description: z.string().optional(),
});

export const userSchema = z.object({
  email: z.string().email("Invalid email").min(1, "Required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional(),
  full_name: z.string().optional(),
  username: z.string().optional(),
  is_super_admin: z.boolean().optional(),
});

export const attendanceSchema = z.object({
  date: z.date({
    message: "Required",
  }),
  beer_count: z
    .number()
    .min(0, "Must be at least 0")
    .int("Must be a whole number"),
  tent_ids: z.array(z.string()).min(1, "At least one tent must be selected"),
});

export type GroupFormData = z.infer<typeof groupSchema>;
export type UserFormData = z.infer<typeof userSchema>;
export type AttendanceFormData = z.infer<typeof attendanceSchema>;
