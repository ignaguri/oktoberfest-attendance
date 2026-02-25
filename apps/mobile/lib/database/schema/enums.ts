/**
 * Enums mirroring Supabase types.
 * Kept as TypeScript types (not Drizzle enums) since SQLite doesn't have native enums.
 */

export type DrinkType =
  | "beer"
  | "radler"
  | "alcohol_free"
  | "wine"
  | "soft_drink"
  | "other";

export const DRINK_TYPES = [
  "beer",
  "radler",
  "alcohol_free",
  "wine",
  "soft_drink",
  "other",
] as const;

export type PhotoVisibility = "public" | "private";
export const PHOTO_VISIBILITIES = ["public", "private"] as const;

export type FestivalStatus = "upcoming" | "active" | "ended";
export const FESTIVAL_STATUSES = ["upcoming", "active", "ended"] as const;

export type FestivalType =
  | "oktoberfest"
  | "starkbierfest"
  | "fruehlingsfest"
  | "other";

export const FESTIVAL_TYPES = [
  "oktoberfest",
  "starkbierfest",
  "fruehlingsfest",
  "other",
] as const;

export type AchievementCategory =
  | "consumption"
  | "attendance"
  | "explorer"
  | "social"
  | "competitive"
  | "special";

export const ACHIEVEMENT_CATEGORIES = [
  "consumption",
  "attendance",
  "explorer",
  "social",
  "competitive",
  "special",
] as const;

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";
export const ACHIEVEMENT_RARITIES = [
  "common",
  "rare",
  "epic",
  "legendary",
] as const;

export type SyncOperationType = "INSERT" | "UPDATE" | "DELETE" | "UPLOAD_FILE";
export const SYNC_OPERATION_TYPES = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "UPLOAD_FILE",
] as const;

export type SyncStatus = "pending" | "processing" | "failed" | "completed";
export const SYNC_STATUSES = [
  "pending",
  "processing",
  "failed",
  "completed",
] as const;
