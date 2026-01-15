import { z } from "zod";
import { TZDate } from "@date-fns/tz";
import { add } from "date-fns";
import { DEFAULT_TIMEZONE } from "../constants/app";

/**
 * Shared form validation schemas for web and mobile
 * All error messages use i18n translation keys
 */

// =============================================================================
// Profile Forms
// =============================================================================

export type ProfileForm = z.infer<typeof ProfileFormSchema>;
export const ProfileFormSchema = z.object({
  fullname: z.string().optional(),
  username: z.string().min(4, { error: "validation.username.min" }).trim(),
  preferred_language: z
    .string()
    .nullable()
    .refine((val) => val === null || ["en", "de", "es", "fr"].includes(val), {
      error: "validation.language.invalid",
    })
    .optional(),
});

// =============================================================================
// Group Forms
// =============================================================================

export type CreateGroupForm = z.infer<typeof CreateGroupFormSchema>;
export const CreateGroupFormSchema = z.object({
  groupName: z
    .string()
    .min(1, { error: "validation.groupName.required" })
    .trim(),
  password: z
    .string()
    .min(1, { error: "validation.groupPassword.required" })
    .trim(),
});

export type JoinGroupForm = z.infer<typeof JoinGroupFormSchema>;
export const JoinGroupFormSchema = z.object({
  groupName: z
    .string()
    .min(1, { error: "validation.groupName.required" })
    .trim(),
  password: z
    .string()
    .min(1, { error: "validation.groupPassword.required" })
    .trim(),
});

export type GroupSettingsForm = z.infer<typeof GroupSettingsFormSchema>;
export const GroupSettingsFormSchema = z.object({
  name: z.string().min(1, { error: "validation.groupName.required" }).trim(),
  description: z.string().optional(),
  winning_criteria_id: z
    .number()
    .min(1, { error: "validation.winningCriteria.required" }),
});

// =============================================================================
// Attendance Forms
// =============================================================================

export type QuickAttendanceForm = z.infer<typeof QuickAttendanceFormSchema>;
export const QuickAttendanceFormSchema = z.object({
  tentId: z.string(),
  beerCount: z.number().min(0, { error: "validation.beerCount.min" }),
});

/**
 * Factory function to create detailed attendance schema with dynamic festival dates
 * @param festivalStartDate - Start date of the festival
 * @param festivalEndDate - End date of the festival
 * @param timezone - Timezone for date validation (defaults to Europe/Berlin)
 */
export function createDetailedAttendanceFormSchema(
  festivalStartDate: Date,
  festivalEndDate: Date,
  timezone: string = DEFAULT_TIMEZONE,
) {
  const dayAfterFestival = add(new TZDate(festivalEndDate, timezone), {
    days: 1,
  });

  return z
    .object({
      amount: z.number().min(0, { error: "validation.beerCount.min" }),
      date: z
        .date()
        .min(festivalStartDate, { error: "validation.date.festivalNotStarted" })
        .max(dayAfterFestival, { error: "validation.date.festivalEnded" }),
      tents: z.array(z.string()),
    })
    .refine(
      (data) => {
        // Must select at least one tent if beer count is 0
        return (
          data.amount !== 0 || (data.amount === 0 && data.tents.length > 0)
        );
      },
      {
        error: "validation.tent.required",
        path: ["amount"],
      },
    );
}

export type DetailedAttendanceForm = z.infer<
  ReturnType<typeof createDetailedAttendanceFormSchema>
>;

// =============================================================================
// Reservation Forms
// =============================================================================

export type ReservationForm = z.infer<typeof ReservationFormSchema>;
export const ReservationFormSchema = z.object({
  tentId: z.string().min(1, { error: "validation.tent.required" }),
  startAt: z.date({ error: "validation.date.required" }),
  reminderOffsetMinutes: z
    .number()
    .min(0, { error: "validation.reminder.min" }),
  visibleToGroups: z.boolean(),
});

// =============================================================================
// Photo Visibility Forms
// =============================================================================

export type PhotoVisibilityForm = z.infer<typeof PhotoVisibilityFormSchema>;
export const PhotoVisibilityFormSchema = z.object({
  visibility: z.enum(["public", "private"]).default("public"),
});

export type GlobalPhotoSettingsForm = z.infer<
  typeof GlobalPhotoSettingsFormSchema
>;
export const GlobalPhotoSettingsFormSchema = z.object({
  hide_photos_from_all_groups: z.boolean().default(false),
});

export type GroupPhotoSettingsForm = z.infer<
  typeof GroupPhotoSettingsFormSchema
>;
export const GroupPhotoSettingsFormSchema = z.object({
  group_id: z.uuid(),
  hide_photos_from_group: z.boolean().default(false),
});

export type BulkPhotoVisibilityForm = z.infer<
  typeof BulkPhotoVisibilityFormSchema
>;
export const BulkPhotoVisibilityFormSchema = z.object({
  photo_ids: z.array(z.uuid()).min(1, { error: "validation.photo.selectOne" }),
  visibility: z.enum(["public", "private"]),
});
