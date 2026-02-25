/**
 * Complex Drizzle Query Helpers
 *
 * Type-safe query builders for complex multi-table queries.
 * Extracted from hooks.ts and adapted-hooks.ts to reduce duplication
 * and improve maintainability.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import type { DrizzleDb } from "./db";
import { achievements, userAchievements } from "./schema/achievements";
import { attendances } from "./schema/attendances";
import { consumptions } from "./schema/consumptions";
import { festivals } from "./schema/festivals";
import { groupMembers, groups } from "./schema/groups";
import { profiles } from "./schema/profiles";
import { tents } from "./schema/tents";

// =============================================================================
// Attendance Queries with Consumption Aggregations
// =============================================================================

/**
 * Query attendances with consumption totals (drink count, total spent, etc.).
 * Returns attendances ordered by date DESC with aggregated consumption data.
 *
 * Used by: useAdaptedAttendances, useAdaptedAttendanceByDate
 */
export async function queryAttendancesWithTotals(
  db: DrizzleDb,
  festivalId: string,
) {
  const result = await db
    .select({
      // Attendance fields
      id: attendances.id,
      user_id: attendances.user_id,
      festival_id: attendances.festival_id,
      date: attendances.date,
      beer_count: attendances.beer_count,
      created_at: attendances.created_at,
      updated_at: attendances.updated_at,
      // Aggregated consumption fields
      drinkCount: sql<number>`COALESCE(COUNT(${consumptions.id}), 0)`,
      totalSpentCents: sql<number>`COALESCE(SUM(${consumptions.price_paid_cents}), 0)`,
      totalBaseCents: sql<number>`COALESCE(SUM(${consumptions.base_price_cents}), 0)`,
      totalTipCents: sql<number>`COALESCE(SUM(${consumptions.tip_cents}), 0)`,
    })
    .from(attendances)
    .leftJoin(
      consumptions,
      and(
        eq(consumptions.attendance_id, attendances.id),
        eq(consumptions._deleted, 0),
      ),
    )
    .where(
      and(eq(attendances.festival_id, festivalId), eq(attendances._deleted, 0)),
    )
    .groupBy(attendances.id)
    .orderBy(sql`${attendances.date} DESC`);

  return result;
}

/**
 * Query a single attendance by festival and date with consumption totals.
 *
 * Used by: useAdaptedAttendanceByDate
 */
export async function queryAttendanceByDateWithTotals(
  db: DrizzleDb,
  festivalId: string,
  date: string,
) {
  const result = await db
    .select({
      id: attendances.id,
      user_id: attendances.user_id,
      festival_id: attendances.festival_id,
      date: attendances.date,
      beer_count: attendances.beer_count,
      created_at: attendances.created_at,
      updated_at: attendances.updated_at,
      drinkCount: sql<number>`COALESCE(COUNT(${consumptions.id}), 0)`,
      totalSpentCents: sql<number>`COALESCE(SUM(${consumptions.price_paid_cents}), 0)`,
      totalBaseCents: sql<number>`COALESCE(SUM(${consumptions.base_price_cents}), 0)`,
      totalTipCents: sql<number>`COALESCE(SUM(${consumptions.tip_cents}), 0)`,
    })
    .from(attendances)
    .leftJoin(
      consumptions,
      and(
        eq(consumptions.attendance_id, attendances.id),
        eq(consumptions._deleted, 0),
      ),
    )
    .where(
      and(
        eq(attendances.festival_id, festivalId),
        eq(attendances.date, date),
        eq(attendances._deleted, 0),
      ),
    )
    .groupBy(attendances.id)
    .limit(1);

  return result[0] ?? null;
}

// =============================================================================
// Group Queries with Member Count
// =============================================================================

/**
 * Query groups with member count for a festival.
 * Returns groups ordered by created_at DESC with member_count field.
 *
 * Used by: useAdaptedGroups
 */
export async function queryGroupsWithMemberCount(
  db: DrizzleDb,
  festivalId: string,
) {
  // Create alias for subquery
  const gm = alias(groupMembers, "gm");

  const result = await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      festival_id: groups.festival_id,
      winning_criteria_id: groups.winning_criteria_id,
      invite_token: groups.invite_token,
      created_by: groups.created_by,
      created_at: groups.created_at,
      // Subquery for member count
      member_count: sql<number>`COALESCE(
        (SELECT COUNT(*) FROM ${groupMembers} ${gm}
         WHERE ${gm.group_id} = ${groups.id} AND ${gm._deleted} = 0),
        0
      )`,
    })
    .from(groups)
    .where(and(eq(groups.festival_id, festivalId), eq(groups._deleted, 0)))
    .orderBy(sql`${groups.created_at} DESC`);

  return result;
}

// =============================================================================
// Consumption Queries
// =============================================================================

/**
 * Query consumptions for a festival and date.
 * Joins with attendances to filter by festival_id and date.
 *
 * Used by: useLocalConsumptionsByDate
 */
export async function queryConsumptionsByDate(
  db: DrizzleDb,
  festivalId: string,
  date: string,
) {
  const result = await db
    .select({
      id: consumptions.id,
      attendance_id: consumptions.attendance_id,
      drink_type: consumptions.drink_type,
      drink_name: consumptions.drink_name,
      volume_ml: consumptions.volume_ml,
      tent_id: consumptions.tent_id,
      recorded_at: consumptions.recorded_at,
      base_price_cents: consumptions.base_price_cents,
      tip_cents: consumptions.tip_cents,
      price_paid_cents: consumptions.price_paid_cents,
      idempotency_key: consumptions.idempotency_key,
      created_at: consumptions.created_at,
      updated_at: consumptions.updated_at,
      _synced_at: consumptions._synced_at,
      _deleted: consumptions._deleted,
      _dirty: consumptions._dirty,
    })
    .from(consumptions)
    .innerJoin(attendances, eq(consumptions.attendance_id, attendances.id))
    .where(
      and(
        eq(attendances.festival_id, festivalId),
        eq(attendances.date, date),
        eq(consumptions._deleted, 0),
      ),
    )
    .orderBy(sql`${consumptions.recorded_at} DESC`);

  return result;
}
// =============================================================================
// Festival Queries
// =============================================================================

/**
 * Query all festivals ordered by start date.
 */
export async function queryFestivals(db: DrizzleDb) {
  return await db
    .select()
    .from(festivals)
    .where(eq(festivals._deleted, 0))
    .orderBy(sql`${festivals.start_date} DESC`);
}

/**
 * Query a single festival by ID.
 */
export async function queryFestivalById(db: DrizzleDb, festivalId: string) {
  const result = await db
    .select()
    .from(festivals)
    .where(and(eq(festivals.id, festivalId), eq(festivals._deleted, 0)))
    .limit(1);

  return result[0] ?? null;
}

// =============================================================================
// Tent Queries
// =============================================================================

/**
 * Query all tents ordered by name.
 */
export async function queryTents(db: DrizzleDb) {
  return await db
    .select()
    .from(tents)
    .where(eq(tents._deleted, 0))
    .orderBy(tents.name);
}

// =============================================================================
// Attendance Queries (Simple)
// =============================================================================

/**
 * Query all attendances for a festival ordered by date DESC.
 */
export async function queryAttendancesByFestival(
  db: DrizzleDb,
  festivalId: string,
) {
  return await db
    .select()
    .from(attendances)
    .where(
      and(eq(attendances.festival_id, festivalId), eq(attendances._deleted, 0)),
    )
    .orderBy(sql`${attendances.date} DESC`);
}

/**
 * Query a single attendance by festival and date.
 */
export async function queryAttendanceByDate(
  db: DrizzleDb,
  festivalId: string,
  date: string,
) {
  const result = await db
    .select()
    .from(attendances)
    .where(
      and(
        eq(attendances.festival_id, festivalId),
        eq(attendances.date, date),
        eq(attendances._deleted, 0),
      ),
    )
    .limit(1);

  return result[0] ?? null;
}

// =============================================================================
// Consumption Queries (Simple)
// =============================================================================

/**
 * Query consumptions for a specific attendance.
 */
export async function queryConsumptionsByAttendance(
  db: DrizzleDb,
  attendanceId: string,
) {
  return await db
    .select()
    .from(consumptions)
    .where(
      and(
        eq(consumptions.attendance_id, attendanceId),
        eq(consumptions._deleted, 0),
      ),
    )
    .orderBy(sql`${consumptions.recorded_at} DESC`);
}

/**
 * Query all consumptions for a festival ordered by recorded_at DESC.
 */
export async function queryConsumptionsByFestival(
  db: DrizzleDb,
  festivalId: string,
) {
  return await db
    .select()
    .from(consumptions)
    .where(
      and(
        eq(consumptions.attendance_id, festivalId),
        eq(consumptions._deleted, 0),
      ),
    )
    .orderBy(sql`${consumptions.recorded_at} DESC`);
}

// =============================================================================
// Profile Queries
// =============================================================================

/**
 * Query user profile by ID.
 */
export async function queryProfileById(db: DrizzleDb, userId: string) {
  const result = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, userId), eq(profiles._deleted, 0)))
    .limit(1);

  return result[0] ?? null;
}

// =============================================================================
// Achievement Queries
// =============================================================================

/**
 * Query all active achievements ordered by points DESC.
 */
export async function queryAchievements(db: DrizzleDb) {
  return await db
    .select()
    .from(achievements)
    .where(and(eq(achievements._deleted, 0), eq(achievements.is_active, 1)))
    .orderBy(desc(achievements.points));
}

/**
 * Query user achievements for a festival by user and festival.
 */
export async function queryUserAchievements(
  db: DrizzleDb,
  userId: string,
  festivalId: string,
) {
  return await db
    .select()
    .from(userAchievements)
    .where(
      and(
        eq(userAchievements.user_id, userId),
        eq(userAchievements.festival_id, festivalId),
        eq(userAchievements._deleted, 0),
      ),
    )
    .orderBy(sql`${userAchievements.unlocked_at} DESC`);
}

/**
 * Query user achievements for a festival (no user filter).
 * Since the local SQLite only stores the current user's data,
 * filtering by user_id is unnecessary for local queries.
 */
export async function queryUserAchievementsByFestival(
  db: DrizzleDb,
  festivalId: string,
) {
  return await db
    .select()
    .from(userAchievements)
    .where(
      and(
        eq(userAchievements.festival_id, festivalId),
        eq(userAchievements._deleted, 0),
      ),
    )
    .orderBy(sql`${userAchievements.unlocked_at} DESC`);
}

// =============================================================================
// Group Queries (Simple)
// =============================================================================

/**
 * Query groups for a festival.
 */
export async function queryGroupsByFestival(db: DrizzleDb, festivalId: string) {
  return await db
    .select()
    .from(groups)
    .where(and(eq(groups.festival_id, festivalId), eq(groups._deleted, 0)))
    .orderBy(sql`${groups.created_at} DESC`);
}
