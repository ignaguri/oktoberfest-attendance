/**
 * Bulk per-day summary reads for the attendance day list.
 *
 * Each function returns a Map keyed by attendance date (YYYY-MM-DD) so the list
 * can render every row from a single query. Do NOT replace these with the
 * per-day hooks (useAdaptedConsumptionsByDate and friends) — one query per row
 * is an N+1 of both a SQLite read and a React Query cache entry.
 *
 * Raw SQL rather than Drizzle: UNION is awkward in the query builder, and having
 * the statements as plain strings lets ./__tests__/day-summaries.integration.test.ts
 * run them against a real SQLite database, where a wrong column or a missing
 * `_deleted` filter fails instead of passing silently against a mock.
 *
 * The local `attendances` table (and every table that joins to it here) holds
 * only the signed-in user's rows, so user scoping is implicit throughout this
 * file — queryAttendancesWithTotals makes the same assumption. The `user_id`
 * join in TENT_NAMES_SQL's tent_visits branch is incidental (it disambiguates
 * the join keys), not load-bearing; DRINK_COUNTS_SQL and PHOTO_COUNTS_SQL
 * don't scope by user_id at all, and that's fine for the same reason.
 */

import type { SQLiteBindParams } from "expo-sqlite";

import { DRINK_TYPES, type DrinkType } from "./schema/enums";

/** Minimal surface of expo-sqlite's database that these reads need. */
export interface SQLiteLike {
  getAllAsync<T>(sql: string, params: SQLiteBindParams): Promise<T[]>;
}

export interface TentNameRow {
  date: string;
  tent_name: string | null;
}

export interface DrinkCountRow {
  date: string;
  drink_type: string | null;
  count: number;
}

export interface PhotoCountRow {
  date: string;
  count: number;
}

/**
 * Tents for a day come from two independent sources that neither subsume nor
 * duplicate each other: an explicit tent_visits row (written by reservation
 * check-in and the "Visited Tents" selector, and possible with no consumption
 * at all) and consumptions.tent_id (a drink bought at a tent). UNION collapses
 * identical (date, name) pairs across both.
 *
 * tent_visits.visit_date is compared to attendances.date as a plain string:
 * the sync layer normalizes it to YYYY-MM-DD when writing locally
 * (see sync/pull-user-data.ts:300-312). This invariant is local-only.
 */
const TENT_NAMES_SQL = `
  SELECT a.date AS date, t.name AS tent_name
  FROM tent_visits tv
  JOIN attendances a
    ON a.user_id = tv.user_id
   AND a.festival_id = tv.festival_id
   AND a.date = tv.visit_date
  LEFT JOIN tents t ON t.id = tv.tent_id AND t._deleted = 0
  WHERE tv.festival_id = ? AND tv._deleted = 0 AND a._deleted = 0
  UNION
  SELECT a.date AS date, t.name AS tent_name
  FROM consumptions c
  JOIN attendances a ON a.id = c.attendance_id
  LEFT JOIN tents t ON t.id = c.tent_id AND t._deleted = 0
  WHERE a.festival_id = ? AND c.tent_id IS NOT NULL AND c._deleted = 0 AND a._deleted = 0
  ORDER BY date, tent_name
`;

/**
 * drink_type is nullable locally with a "beer" column default, so a row written
 * before the column existed is counted as beer rather than dropped.
 */
const DRINK_COUNTS_SQL = `
  SELECT a.date AS date,
         COALESCE(c.drink_type, 'beer') AS drink_type,
         COUNT(*) AS count
  FROM consumptions c
  JOIN attendances a ON a.id = c.attendance_id
  WHERE a.festival_id = ? AND c._deleted = 0 AND a._deleted = 0
  GROUP BY a.date, COALESCE(c.drink_type, 'beer')
`;

const PHOTO_COUNTS_SQL = `
  SELECT a.date AS date, COUNT(*) AS count
  FROM beer_pictures bp
  JOIN attendances a ON a.id = bp.attendance_id
  WHERE a.festival_id = ? AND bp._deleted = 0 AND a._deleted = 0
  GROUP BY a.date
`;

function isDrinkType(value: string): value is DrinkType {
  return (DRINK_TYPES as readonly string[]).includes(value);
}

export function groupTentNames(rows: TentNameRow[]): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const row of rows) {
    if (!row.tent_name) {
      continue;
    }
    const existing = result.get(row.date);
    if (existing) {
      if (!existing.includes(row.tent_name)) {
        existing.push(row.tent_name);
      }
    } else {
      result.set(row.date, [row.tent_name]);
    }
  }

  return result;
}

export function groupDrinkCounts(
  rows: DrinkCountRow[],
): Map<string, Partial<Record<DrinkType, number>>> {
  const result = new Map<string, Partial<Record<DrinkType, number>>>();

  for (const row of rows) {
    const rawType = row.drink_type ?? "beer";
    const drinkType: DrinkType = isDrinkType(rawType) ? rawType : "beer";
    const existing = result.get(row.date) ?? {};
    existing[drinkType] = (existing[drinkType] ?? 0) + row.count;
    result.set(row.date, existing);
  }

  return result;
}

export function groupPhotoCounts(rows: PhotoCountRow[]): Map<string, number> {
  const result = new Map<string, number>();

  for (const row of rows) {
    result.set(row.date, row.count);
  }

  return result;
}

export async function queryTentNamesByDate(
  db: SQLiteLike,
  festivalId: string,
): Promise<Map<string, string[]>> {
  const rows = await db.getAllAsync<TentNameRow>(TENT_NAMES_SQL, [festivalId, festivalId]);
  return groupTentNames(rows);
}

export async function queryDrinkCountsByDate(
  db: SQLiteLike,
  festivalId: string,
): Promise<Map<string, Partial<Record<DrinkType, number>>>> {
  const rows = await db.getAllAsync<DrinkCountRow>(DRINK_COUNTS_SQL, [festivalId]);
  return groupDrinkCounts(rows);
}

export async function queryPhotoCountsByDate(
  db: SQLiteLike,
  festivalId: string,
): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<PhotoCountRow>(PHOTO_COUNTS_SQL, [festivalId]);
  return groupPhotoCounts(rows);
}
