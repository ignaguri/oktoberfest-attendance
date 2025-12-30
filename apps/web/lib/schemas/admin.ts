import { z } from "zod";

export const groupSchema = z.object({
  name: z.string().min(1, "Required").trim(),
  description: z.string().optional(),
  winning_criteria_id: z.number().min(1, "Required"),
});

export const userSchema = z.object({
  email: z.string().email("Invalid email").min(1, "Required"),
  password: z
    .string()
    .refine((val) => val === "" || val.length >= 8, {
      message:
        "Password must be at least 8 characters or leave blank to keep unchanged",
    })
    .optional(),
  full_name: z.string().optional(),
  username: z.string().optional(),
  is_super_admin: z.boolean().optional(),
});

export const userUpdateSchema = z.object({
  password: z
    .string()
    .refine((val) => val === "" || val.length >= 8, {
      message:
        "Password must be at least 8 characters or leave blank to keep unchanged",
    })
    .optional(),
  full_name: z.string().optional(),
  username: z.string().optional(),
  is_super_admin: z.boolean().optional(),
});

export const attendanceSchema = z.object({
  date: z.date({ error: "Required" }),
  beer_count: z
    .number()
    .min(0, "Must be at least 0")
    .int("Must be a whole number"),
  tent_ids: z.array(z.string()).min(1, "At least one tent must be selected"),
});

// Tent management schemas
export const tentSchema = z.object({
  name: z.string().min(1, "Tent name is required").trim(),
  category: z.string().optional(),
});

export const tentPriceSchema = z.object({
  beer_price: z
    .number()
    .positive("Price must be greater than 0")
    .max(50, "Price seems too high")
    .optional()
    .nullable(),
});

// Zod v4: Use object destructuring instead of deprecated .merge()
export const addTentToFestivalSchema = z.object({
  ...tentSchema.shape,
  ...tentPriceSchema.shape,
});

export const copyTentsSchema = z.object({
  sourceFestivalId: z.string().min(1, "Source festival is required"),
  targetFestivalId: z.string().min(1, "Target festival is required"),
  tentIds: z.array(z.string()).min(1, "At least one tent must be selected"),
  copyPrices: z.boolean(),
  overridePrice: z
    .number()
    .positive("Price must be greater than 0")
    .max(50, "Price seems too high")
    .optional()
    .nullable(),
});

export type GroupFormData = z.infer<typeof groupSchema>;
export type UserFormData = z.infer<typeof userSchema>;
export type UserUpdateFormData = z.infer<typeof userUpdateSchema>;
export type AttendanceFormData = z.infer<typeof attendanceSchema>;
export type TentFormData = z.infer<typeof tentSchema>;
export type TentPriceFormData = z.infer<typeof tentPriceSchema>;
export type AddTentToFestivalFormData = z.infer<typeof addTentToFestivalSchema>;
export type CopyTentsFormData = z.infer<typeof copyTentsSchema>;
