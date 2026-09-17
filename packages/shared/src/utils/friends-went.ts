import { type DrinkType, DrinkTypeSchema } from "../schemas/consumption.schema";
import type { FriendWent } from "../schemas/friends-went.schema";
import { formatDateForDatabase } from "./date-utils";

/** Thumbnails the recap shows per friend; the rest is the "+N" tile. */
export const FRIENDS_WENT_PHOTO_LIMIT = 3;

/** What the API reads about other users' attendance on one festival day. */
export interface FriendsWentRows {
  attendances: { attendanceId: string; userId: string }[];
  profiles: {
    userId: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  }[];
  consumptions: { attendanceId: string; drinkType: DrinkType }[];
  /** Visits from a padded UTC window; only those on the festival day count. */
  tentVisits: { userId: string; tentName: string | null; visitDate: string }[];
  photos: { id: string; attendanceId: string; pictureUrl: string; createdAt: string }[];
  /** The viewer's own groups in this festival. */
  viewerGroups: { groupId: string; joinedAt: string | null }[];
  /** Other users' memberships in the viewer's groups. */
  groupMemberships: { groupId: string; userId: string }[];
}

export interface FriendsWentInput extends FriendsWentRows {
  /** The festival day, YYYY-MM-DD. */
  date: string;
  /** The festival's timezone, which decides the day a tent visit falls on. */
  timezone: string;
}

type ViewerGroup = FriendsWentRows["viewerGroups"][number];

const DRINK_ORDER: readonly DrinkType[] = DrinkTypeSchema.options;

function sortName(friend: Pick<FriendWent, "username" | "fullName">): string {
  return (friend.username ?? friend.fullName ?? "").toLocaleLowerCase();
}

/** Latest join first, groups with no join date last, then by id so the pick is stable. */
function byMostRecentJoin(a: ViewerGroup, b: ViewerGroup): number {
  if (a.joinedAt !== b.joinedAt) {
    if (a.joinedAt === null) {
      return 1;
    }
    if (b.joinedAt === null) {
      return -1;
    }
    const joinedDifference = Date.parse(b.joinedAt) - Date.parse(a.joinedAt);
    if (joinedDifference !== 0) {
      return joinedDifference;
    }
  }
  return a.groupId.localeCompare(b.groupId);
}

function countDrinks(drinkTypes: DrinkType[]): FriendWent["drinks"] {
  const counts = new Map<DrinkType, number>();

  for (const drinkType of drinkTypes) {
    counts.set(drinkType, (counts.get(drinkType) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || DRINK_ORDER.indexOf(a.type) - DRINK_ORDER.indexOf(b.type));
}

/**
 * One recap entry per friend who logged the day: drinks by type, tents in the
 * order they were visited, the newest photos, and a shared group whose gallery
 * holds them.
 *
 * Most drinks first, then names alphabetically.
 */
export function groupFriendsWent(input: FriendsWentInput): FriendWent[] {
  const profilesByUser = new Map(input.profiles.map((profile) => [profile.userId, profile]));
  const groupsByRecency = [...input.viewerGroups].sort(byMostRecentJoin);
  const visitsOnDay = input.tentVisits
    .filter(
      (visit) => formatDateForDatabase(new Date(visit.visitDate), input.timezone) === input.date,
    )
    .sort((a, b) => Date.parse(a.visitDate) - Date.parse(b.visitDate));

  return input.attendances
    .map((attendance): FriendWent => {
      const profile = profilesByUser.get(attendance.userId);
      const drinks = countDrinks(
        input.consumptions
          .filter((consumption) => consumption.attendanceId === attendance.attendanceId)
          .map((consumption) => consumption.drinkType),
      );
      const tents = [
        ...new Set(
          visitsOnDay
            .filter((visit) => visit.userId === attendance.userId)
            .map((visit) => visit.tentName)
            .filter((name): name is string => name !== null),
        ),
      ];
      const photos = input.photos
        .filter((photo) => photo.attendanceId === attendance.attendanceId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const friendGroupIds = new Set(
        input.groupMemberships
          .filter((membership) => membership.userId === attendance.userId)
          .map((membership) => membership.groupId),
      );
      const sharedGroup = groupsByRecency.find((group) => friendGroupIds.has(group.groupId));

      return {
        userId: attendance.userId,
        username: profile?.username ?? null,
        fullName: profile?.fullName ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        totalDrinks: drinks.reduce((total, drink) => total + drink.count, 0),
        drinks,
        tents,
        photoCount: photos.length,
        photos: photos
          .slice(0, FRIENDS_WENT_PHOTO_LIMIT)
          .map(({ id, pictureUrl }) => ({ id, pictureUrl })),
        sharedGroupId: sharedGroup?.groupId ?? null,
      };
    })
    .sort((a, b) => b.totalDrinks - a.totalDrinks || sortName(a).localeCompare(sortName(b)));
}
