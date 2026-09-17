import { z } from "zod";

import { ReservationStatusSchema } from "./reservation.schema";

/** A day plan is either a plan to go, or a tent reservation. One per user per day. */
export const DayPlanKindSchema = z.enum(["plan", "reservation"]);

export type DayPlanKind = z.infer<typeof DayPlanKindSchema>;

export const DAY_PLAN_NOTE_MAX_LENGTH = 200;

/** Caps on how many people and groups one plan can tag. */
export const DAY_PLAN_MAX_COMPANION_USERS = 50;
export const DAY_PLAN_MAX_COMPANION_GROUPS = 20;

/** A person a plan is tagged with, or who can be tagged. */
export const DayPlanCompanionUserSchema = z.object({
  userId: z.uuid(),
  username: z.string().nullable(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export type DayPlanCompanionUser = z.infer<typeof DayPlanCompanionUserSchema>;

/** A group a plan is tagged with, or that can be tagged. */
export const DayPlanCompanionGroupSchema = z.object({
  groupId: z.uuid(),
  name: z.string(),
});

export type DayPlanCompanionGroup = z.infer<typeof DayPlanCompanionGroupSchema>;

/**
 * Who a plan's owner is going with. Display only. A group the reader can't see
 * is left out.
 */
export const DayPlanCompanionsSchema = z.object({
  users: z.array(DayPlanCompanionUserSchema),
  groups: z.array(DayPlanCompanionGroupSchema),
});

export type DayPlanCompanions = z.infer<typeof DayPlanCompanionsSchema>;

/**
 * A user's mark on one festival day.
 *
 * Reservation-only fields are null on a plan.
 */
export const DayPlanSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  festivalId: z.uuid(),
  date: z.iso.date(),
  kind: DayPlanKindSchema,
  tentId: z.uuid().nullable(),
  tentName: z.string().nullable(),
  note: z.string().nullable(),
  visibleToGroups: z.boolean(),
  companions: DayPlanCompanionsSchema,
  startAt: z.iso.datetime().nullable(),
  endAt: z.iso.datetime().nullable(),
  status: ReservationStatusSchema.nullable(),
  reminderOffsetMinutes: z.number().int().nullable(),
  autoCheckin: z.boolean().nullable(),
  reminderSentAt: z.iso.datetime().nullable(),
  promptSentAt: z.iso.datetime().nullable(),
  processedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});

export type DayPlan = z.infer<typeof DayPlanSchema>;

/**
 * GET /api/v1/festivals/:festivalId/plans
 * GET /api/v1/festivals/:festivalId/friends-going
 */
export const DayPlanFestivalParamSchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
});

/**
 * PUT|DELETE /api/v1/festivals/:festivalId/days/:date/plan
 */
export const DayPlanPathParamsSchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  date: z.iso.date({ error: "Invalid date" }),
});

const noteSchema = z.string().max(DAY_PLAN_NOTE_MAX_LENGTH).nullable().optional();

/** Omitted keeps the plan's current tags; sent replaces them. */
const companionsInputSchema = z
  .object({
    userIds: z.array(z.uuid()).max(DAY_PLAN_MAX_COMPANION_USERS),
    groupIds: z.array(z.uuid()).max(DAY_PLAN_MAX_COMPANION_GROUPS),
  })
  .optional();

/**
 * PUT /api/v1/festivals/:festivalId/days/:date/plan
 *
 * Upserts the day's single active mark. Switching kind updates the same row.
 */
export const UpsertDayPlanSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("plan"),
    tentId: z.uuid({ error: "Invalid tent ID" }).nullable().optional(),
    note: noteSchema,
    visibleToGroups: z.boolean(),
    companions: companionsInputSchema,
  }),
  z.object({
    kind: z.literal("reservation"),
    tentId: z.uuid({ error: "Invalid tent ID" }),
    startAt: z.iso.datetime({ error: "Invalid start time" }),
    note: noteSchema,
    visibleToGroups: z.boolean(),
    companions: companionsInputSchema,
    reminderOffsetMinutes: z.number().int().min(0).max(1440).optional(),
    autoCheckin: z.boolean().optional(),
  }),
]);

export type UpsertDayPlanInput = z.infer<typeof UpsertDayPlanSchema>;

export const DayPlanResponseSchema = z.object({
  plan: DayPlanSchema,
});

export type DayPlanResponse = z.infer<typeof DayPlanResponseSchema>;

export const ListDayPlansResponseSchema = z.object({
  plans: z.array(DayPlanSchema),
});

export type ListDayPlansResponse = z.infer<typeof ListDayPlansResponseSchema>;

export const DeleteDayPlanResponseSchema = z.object({
  success: z.boolean(),
});

export type DeleteDayPlanResponse = z.infer<typeof DeleteDayPlanResponseSchema>;

/** A friend or group-mate with a visible plan or reservation on a day. */
export const FriendGoingSchema = z.object({
  userId: z.uuid(),
  username: z.string().nullable(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  kind: DayPlanKindSchema,
  tentName: z.string().nullable(),
  startAt: z.iso.datetime().nullable(),
  note: z.string().nullable(),
  companions: DayPlanCompanionsSchema,
});

export type FriendGoing = z.infer<typeof FriendGoingSchema>;

export const FriendsGoingDaySchema = z.object({
  date: z.iso.date(),
  users: z.array(FriendGoingSchema),
});

export type FriendsGoingDay = z.infer<typeof FriendsGoingDaySchema>;

export const GetFriendsGoingResponseSchema = z.object({
  days: z.array(FriendsGoingDaySchema),
});

export type GetFriendsGoingResponse = z.infer<typeof GetFriendsGoingResponseSchema>;

/**
 * GET /api/v1/festivals/:festivalId/plan-companions
 *
 * Who the user can tag on a plan: friends and group-mates for the festival, and
 * the user's groups in it.
 */
export const GetCompanionOptionsResponseSchema = z.object({
  users: z.array(DayPlanCompanionUserSchema),
  groups: z.array(DayPlanCompanionGroupSchema),
});

export type GetCompanionOptionsResponse = z.infer<typeof GetCompanionOptionsResponseSchema>;
