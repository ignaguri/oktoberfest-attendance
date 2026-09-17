import { z } from "zod";

import { DrinkTypeSchema } from "./consumption.schema";

/** GET /attendance/friends-went query. */
export const GetFriendsWentQuerySchema = z.object({
  festivalId: z.uuid(),
  date: z.iso.date(),
});

export type GetFriendsWentQuery = z.infer<typeof GetFriendsWentQuerySchema>;

export const FriendWentDrinkSchema = z.object({
  type: DrinkTypeSchema,
  count: z.number().int().positive(),
});

export const FriendWentPhotoSchema = z.object({
  id: z.uuid(),
  pictureUrl: z.string(),
});

/** A friend or group-mate who logged a past festival day. */
export const FriendWentSchema = z.object({
  userId: z.uuid(),
  username: z.string().nullable(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  totalDrinks: z.number().int().nonnegative(),
  drinks: z.array(FriendWentDrinkSchema),
  tents: z.array(z.string()),
  photoCount: z.number().int().nonnegative(),
  photos: z.array(FriendWentPhotoSchema),
  /** A group you share in this festival whose gallery holds these photos, if any. */
  sharedGroupId: z.uuid().nullable(),
});

export type FriendWent = z.infer<typeof FriendWentSchema>;

export const GetFriendsWentResponseSchema = z.object({
  friends: z.array(FriendWentSchema),
});

export type GetFriendsWentResponse = z.infer<typeof GetFriendsWentResponseSchema>;
