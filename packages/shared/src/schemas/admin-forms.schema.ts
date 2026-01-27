import { z } from "zod";

/**
 * Admin panel form validation schemas
 * These are used in the admin panel for managing users, groups, attendances, and tents
 */

// =============================================================================
// Admin Group Forms
// =============================================================================

export type AdminGroupForm = z.infer<typeof AdminGroupFormSchema>;
export const AdminGroupFormSchema = z.object({
  name: z.string().min(1, { error: "validation.required" }).trim(),
  description: z.string().optional(),
  winning_criteria_id: z.number().min(1, { error: "validation.required" }),
});

// =============================================================================
// Admin User Forms
// =============================================================================

export type AdminUserForm = z.infer<typeof AdminUserFormSchema>;
export const AdminUserFormSchema = z.object({
  email: z
    .string()
    .email({ error: "validation.email.invalid" })
    .min(1, { error: "validation.required" }),
  password: z
    .string()
    .refine((val) => val === "" || val.length >= 8, {
      error: "validation.password.min",
    })
    .optional(),
  full_name: z.string().optional(),
  username: z.string().optional(),
  is_super_admin: z.boolean().optional(),
});

export type AdminUserUpdateForm = z.infer<typeof AdminUserUpdateFormSchema>;
export const AdminUserUpdateFormSchema = z.object({
  password: z
    .string()
    .refine((val) => val === "" || val.length >= 8, {
      error: "validation.password.min",
    })
    .optional(),
  full_name: z.string().optional(),
  username: z.string().optional(),
  is_super_admin: z.boolean().optional(),
});

// =============================================================================
// Admin Attendance Forms
// =============================================================================

export type AdminAttendanceForm = z.infer<typeof AdminAttendanceFormSchema>;
export const AdminAttendanceFormSchema = z.object({
  date: z.date({ error: "validation.required" }),
  beer_count: z
    .number()
    .min(0, { error: "validation.beerCount.min" })
    .int({ error: "validation.beerCount.integer" }),
  tent_ids: z.array(z.string()).min(1, { error: "validation.tent.minOne" }),
});

// =============================================================================
// Admin Tent Forms
// =============================================================================

export type AdminTentForm = z.infer<typeof AdminTentFormSchema>;
export const AdminTentFormSchema = z.object({
  name: z.string().min(1, { error: "validation.tent.nameRequired" }).trim(),
  category: z.string().optional(),
});

export type AdminTentPriceForm = z.infer<typeof AdminTentPriceFormSchema>;
export const AdminTentPriceFormSchema = z.object({
  beer_price: z
    .number()
    .positive({ error: "validation.price.positive" })
    .max(50, { error: "validation.price.tooHigh" })
    .optional()
    .nullable(),
});

export type AdminAddTentToFestivalForm = z.infer<
  typeof AdminAddTentToFestivalFormSchema
>;
export const AdminAddTentToFestivalFormSchema = z.object({
  name: z.string().min(1, { error: "validation.tent.nameRequired" }).trim(),
  category: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  beer_price: z
    .number()
    .positive({ error: "validation.price.positive" })
    .max(50, { error: "validation.price.tooHigh" })
    .optional()
    .nullable(),
});

export type AdminCopyTentsForm = z.infer<typeof AdminCopyTentsFormSchema>;
export const AdminCopyTentsFormSchema = z.object({
  sourceFestivalId: z
    .string()
    .min(1, { error: "validation.festival.sourceRequired" }),
  targetFestivalId: z
    .string()
    .min(1, { error: "validation.festival.targetRequired" }),
  tentIds: z.array(z.string()).min(1, { error: "validation.tent.minOne" }),
  copyPrices: z.boolean(),
  overridePrice: z
    .number()
    .positive({ error: "validation.price.positive" })
    .max(50, { error: "validation.price.tooHigh" })
    .optional()
    .nullable(),
});
