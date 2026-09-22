import { z } from "zod";

/** A group both the viewer and the profile's owner belong to. */
export const ProfileSharedGroupSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

export type ProfileSharedGroup = z.infer<typeof ProfileSharedGroupSchema>;

/** One festival the profile's owner attended. Gated: empty for a stranger. */
export const ProfileHistoryRowSchema = z.object({
  festivalId: z.uuid(),
  festivalName: z.string(),
  daysAttended: z.number().int().nonnegative(),
  totalBeers: z.number().int().nonnegative(),
  avgBeers: z.number().nonnegative(),
});

export type ProfileHistoryRow = z.infer<typeof ProfileHistoryRowSchema>;

/**
 * The whole profile page in one payload.
 *
 * `favouriteTent` and `history` are gated by RLS rather than by a flag: a
 * viewer who is neither a friend nor a group mate reads zero underlying rows,
 * so they arrive null and empty with no branch anywhere in the code.
 */
export const ProfileDetailSchema = z.object({
  id: z.uuid(),
  username: z.string().nullable(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  stats: z
    .object({
      daysAttended: z.number().nonnegative(),
      totalBeers: z.number().nonnegative(),
      avgBeers: z.number().nonnegative(),
    })
    .nullable(),
  friendshipStatus: z
    .enum(["friends", "pending_sent", "pending_received", "none", "self"])
    .nullable(),
  /** `friendships.updated_at`, the moment the request was accepted. Null unless friends. */
  friendsSince: z.string().nullable(),
  sharedGroups: z.array(ProfileSharedGroupSchema),
  favouriteTent: z
    .object({
      name: z.string(),
      visits: z.number().int().nonnegative(),
    })
    .nullable(),
  history: z.array(ProfileHistoryRowSchema),
});

export type ProfileDetail = z.infer<typeof ProfileDetailSchema>;

/** One festival day, loaded lazily when a history row is expanded. */
export const ProfileDayRowSchema = z.object({
  date: z.string(),
  totalDrinks: z.number().int().nonnegative(),
  tents: z.array(z.string()),
});

export type ProfileDayRow = z.infer<typeof ProfileDayRowSchema>;

export const GetProfileDetailQuerySchema = z.object({
  festivalId: z.uuid().optional(),
});

export type GetProfileDetailQuery = z.infer<typeof GetProfileDetailQuerySchema>;

export const GetProfileDetailResponseSchema = z.object({
  profile: ProfileDetailSchema,
});

export type GetProfileDetailResponse = z.infer<typeof GetProfileDetailResponseSchema>;

export const GetProfileDaysResponseSchema = z.object({
  days: z.array(ProfileDayRowSchema),
});

export type GetProfileDaysResponse = z.infer<typeof GetProfileDaysResponseSchema>;
