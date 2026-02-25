/**
 * Drizzle ORM database instance.
 *
 * Wraps the expo-sqlite database with Drizzle's typed query builder.
 * The raw expo-sqlite client is available via `db.$client` for operations
 * that need direct SQL access (e.g., sync-queue CRUD).
 */

import { drizzle } from "drizzle-orm/expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

import { achievements, userAchievements } from "./schema/achievements";
import { attendances } from "./schema/attendances";
import { beerPictures } from "./schema/beer-pictures";
import { consumptions } from "./schema/consumptions";
import { festivals } from "./schema/festivals";
import { groupMembers, groups } from "./schema/groups";
import { profiles } from "./schema/profiles";
import { syncMetadata, syncQueue } from "./schema/sync-tables";
import {
  drinkTypePrices,
  festivalTents,
  tents,
  tentVisits,
} from "./schema/tents";
import { winningCriteria } from "./schema/winning-criteria";

export const schema = {
  festivals,
  profiles,
  attendances,
  consumptions,
  beerPictures,
  achievements,
  userAchievements,
  groups,
  groupMembers,
  tents,
  festivalTents,
  drinkTypePrices,
  tentVisits,
  winningCriteria,
  syncMetadata,
  syncQueue,
};

export function createDrizzleDb(expoDb: SQLiteDatabase) {
  return drizzle(expoDb, { schema });
}

export type DrizzleDb = ReturnType<typeof createDrizzleDb>;
