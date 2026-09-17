/**
 * Form model for the day planner: one status per day (not going, planning,
 * reserved) and the fields each status uses.
 */

import {
  DAY_PLAN_NOTE_MAX_LENGTH,
  type DayPlan,
  type GetCompanionOptionsResponse,
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
    companionUserIds: z.array(z.string()),
    companionGroupIds: z.array(z.string()),
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
      companionUserIds: [],
      companionGroupIds: [],
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
    companionUserIds: existingPlan.companions.users.map((user) => user.userId),
    companionGroupIds: existingPlan.companions.groups.map((group) => group.groupId),
  };
}

/** The API body for the form, or null when the user picked Not going. */
export function toUpsertInput(
  values: PlannerFormValues,
  selectedDate: Date,
  timezone: string,
  companions?: UpsertDayPlanInput["companions"],
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
      companions,
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
    companions,
    reminderOffsetMinutes: values.reminderOffsetMinutes,
  };
}

/**
 * The companions to send with a save, or undefined to leave the saved tags as
 * they are.
 *
 * Only sent when the user changed them, so a tag that went stale (an unfriended
 * person, a group they left) can't fail an unrelated edit. When they did change
 * them, anyone no longer on offer is dropped for the same reason.
 */
export function resolveCompanionsInput(
  values: Pick<PlannerFormValues, "companionUserIds" | "companionGroupIds">,
  changed: boolean,
  options: GetCompanionOptionsResponse | null,
): UpsertDayPlanInput["companions"] {
  if (!changed) {
    return undefined;
  }
  if (!options) {
    return { userIds: values.companionUserIds, groupIds: values.companionGroupIds };
  }

  const offeredUserIds = new Set(options.users.map((user) => user.userId));
  const offeredGroupIds = new Set(options.groups.map((group) => group.groupId));

  return {
    userIds: values.companionUserIds.filter((userId) => offeredUserIds.has(userId)),
    groupIds: values.companionGroupIds.filter((groupId) => offeredGroupIds.has(groupId)),
  };
}
