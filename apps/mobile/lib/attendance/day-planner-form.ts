/**
 * Form model for the day planner: one status per day (not going, planning,
 * reserved) and the fields each status uses.
 */

import {
  DAY_PLAN_NOTE_MAX_LENGTH,
  type DayPlan,
  type UpsertDayPlanInput,
} from "@prostcounter/shared/schemas";
import { atZonedTime, zonedTimeOnDay } from "@prostcounter/shared/utils";
import { setHours, setMinutes } from "date-fns";
import { z } from "zod";

export type PlannerStatus = "none" | "plan" | "reservation";

export const DEFAULT_RESERVATION_REMINDER_MINUTES = 30;

export const plannerFormSchema = z
  .object({
    status: z.enum(["none", "plan", "reservation"]),
    tentId: z.string(),
    startTime: z.date(),
    note: z.string().max(DAY_PLAN_NOTE_MAX_LENGTH),
    visibleToGroups: z.boolean(),
    reminderOffsetMinutes: z.number().int().min(0).max(1440),
  })
  .refine((values) => values.status !== "reservation" || values.tentId.length > 0, {
    path: ["tentId"],
    message: "tentRequired",
  });

export type PlannerFormValues = z.infer<typeof plannerFormSchema>;

/**
 * Form values for a day. With nothing saved, tapping a future day most likely
 * means "I'm going", so the form opens on Planning rather than Not going.
 *
 * The arrival time is shown on the festival's clock (`timezone`), which is
 * also how the API files a reservation under its day.
 */
export function buildPlannerDefaults(
  existingPlan: DayPlan | null,
  selectedDate: Date,
  timezone: string,
): PlannerFormValues {
  const noon = setMinutes(setHours(selectedDate, 12), 0);

  if (!existingPlan) {
    return {
      status: "plan",
      tentId: "",
      startTime: noon,
      note: "",
      visibleToGroups: true,
      reminderOffsetMinutes: DEFAULT_RESERVATION_REMINDER_MINUTES,
    };
  }

  return {
    status: existingPlan.kind,
    tentId: existingPlan.tentId ?? "",
    startTime: existingPlan.startAt
      ? zonedTimeOnDay(new Date(existingPlan.startAt), selectedDate, timezone)
      : noon,
    note: existingPlan.note ?? "",
    visibleToGroups: existingPlan.visibleToGroups,
    reminderOffsetMinutes:
      existingPlan.reminderOffsetMinutes ?? DEFAULT_RESERVATION_REMINDER_MINUTES,
  };
}

/** The API body for the form, or null when the user picked Not going. */
export function toUpsertInput(
  values: PlannerFormValues,
  selectedDate: Date,
  timezone: string,
): UpsertDayPlanInput | null {
  const trimmedNote = values.note.trim();
  const note = trimmedNote.length > 0 ? trimmedNote : null;

  if (values.status === "none") {
    return null;
  }

  if (values.status === "plan") {
    return {
      kind: "plan",
      tentId: values.tentId.length > 0 ? values.tentId : null,
      note,
      visibleToGroups: values.visibleToGroups,
    };
  }

  return {
    kind: "reservation",
    tentId: values.tentId,
    // On the festival's clock: the API rejects a time that lands on another
    // festival-local day, which a phone set to a far timezone would otherwise send.
    startAt: atZonedTime(selectedDate, values.startTime, timezone).toISOString(),
    note,
    visibleToGroups: values.visibleToGroups,
    reminderOffsetMinutes: values.reminderOffsetMinutes,
  };
}
