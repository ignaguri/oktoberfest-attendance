/**
 * Pull Reference Data
 *
 * Sync operations for server-managed reference tables:
 * festivals, tents, achievements.
 */

import type * as SQLite from "expo-sqlite";

import { logger } from "@/lib/logger";

import { apiClient } from "../../api-client";
import type { LocalAchievement, LocalFestival, LocalTent } from "../schema";
import { updateLastSyncAt } from "../sync-queue";
import { shouldUpdate } from "./conflict";
import type { PullResult } from "./types";

/**
 * Pull festivals from server
 */
export async function pullFestivals(
  db: SQLite.SQLiteDatabase,
): Promise<PullResult> {
  const result: PullResult = {
    table: "festivals",
    inserted: 0,
    updated: 0,
    deleted: 0,
  };

  try {
    const response = await apiClient.festivals.list();
    const festivals = response.data;
    const now = new Date().toISOString();

    for (const festival of festivals) {
      const existing = await db.getFirstAsync<LocalFestival>(
        "SELECT * FROM festivals WHERE id = ?",
        [festival.id],
      );

      // Generate short_name from name (API doesn't return this field)
      const shortName = festival.name
        .substring(0, 20)
        .toLowerCase()
        .replace(/\s+/g, "-");

      if (existing) {
        // Update if server is newer
        if (shouldUpdate(existing, festival.updatedAt)) {
          await db.runAsync(
            `UPDATE festivals SET
              name = ?, short_name = ?, location = ?,
              start_date = ?, end_date = ?, status = ?,
              is_active = ?, beer_cost = ?,
              timezone = ?, map_url = ?, updated_at = ?, _synced_at = ?, _dirty = 0
            WHERE id = ?`,
            [
              festival.name,
              shortName,
              festival.location,
              festival.startDate,
              festival.endDate,
              festival.status,
              festival.isActive ? 1 : 0,
              festival.beerCost ?? null,
              festival.timezone ?? "Europe/Berlin",
              festival.mapUrl ?? null,
              festival.updatedAt,
              now,
              festival.id,
            ],
          );
          result.updated++;
        }
      } else {
        // Insert new
        await db.runAsync(
          `INSERT INTO festivals (
            id, name, short_name, description, location,
            start_date, end_date, festival_type, status,
            is_active, beer_cost, default_beer_price_cents,
            timezone, map_url, created_at, updated_at, _synced_at, _dirty, _deleted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
          [
            festival.id,
            festival.name,
            shortName,
            null, // description - API doesn't return this
            festival.location,
            festival.startDate,
            festival.endDate,
            "oktoberfest", // festival_type - default
            festival.status,
            festival.isActive ? 1 : 0,
            festival.beerCost ?? null,
            null, // default_beer_price_cents - API doesn't return this
            festival.timezone ?? "Europe/Berlin",
            festival.mapUrl ?? null,
            festival.createdAt,
            festival.updatedAt,
            now,
          ],
        );
        result.inserted++;
      }
    }

    await updateLastSyncAt(db, "festivals", now);
  } catch (error) {
    logger.error("[SyncManager] Pull festivals failed:", error);
  }

  return result;
}

/**
 * Pull tents from server
 */
export async function pullTents(
  db: SQLite.SQLiteDatabase,
  festivalId: string,
): Promise<PullResult> {
  const result: PullResult = {
    table: "tents",
    inserted: 0,
    updated: 0,
    deleted: 0,
  };

  try {
    const response = await apiClient.tents.list({ festivalId });
    const festivalTents = response.data;
    const now = new Date().toISOString();

    for (const ft of festivalTents) {
      const tent = ft.tent;
      const existing = await db.getFirstAsync<LocalTent>(
        "SELECT * FROM tents WHERE id = ?",
        [tent.id],
      );

      if (existing) {
        await db.runAsync(
          `UPDATE tents SET name = ?, category = ?, _synced_at = ?, _dirty = 0 WHERE id = ?`,
          [tent.name, tent.category ?? null, now, tent.id],
        );
        result.updated++;
      } else {
        await db.runAsync(
          `INSERT INTO tents (id, name, category, _synced_at, _dirty, _deleted)
           VALUES (?, ?, ?, ?, 0, 0)`,
          [tent.id, tent.name, tent.category ?? null, now],
        );
        result.inserted++;
      }
    }

    await updateLastSyncAt(db, "tents", now);
  } catch (error) {
    logger.error("[SyncManager] Pull tents failed:", error);
  }

  return result;
}

/**
 * Pull achievements from server
 */
export async function pullAchievements(
  db: SQLite.SQLiteDatabase,
): Promise<PullResult> {
  const result: PullResult = {
    table: "achievements",
    inserted: 0,
    updated: 0,
    deleted: 0,
  };

  try {
    const response = await apiClient.achievements.available();
    const achievements = response.data;
    const now = new Date().toISOString();

    for (const ach of achievements) {
      const existing = await db.getFirstAsync<LocalAchievement>(
        "SELECT * FROM achievements WHERE id = ?",
        [ach.id],
      );

      if (existing) {
        await db.runAsync(
          `UPDATE achievements SET
            name = ?, description = ?, icon = ?, category = ?,
            rarity = ?, points = ?, is_active = ?, updated_at = ?,
            _synced_at = ?, _dirty = 0
          WHERE id = ?`,
          [
            ach.name,
            ach.description,
            ach.icon,
            ach.category,
            ach.rarity,
            ach.points,
            ach.is_active ? 1 : 0,
            now,
            now,
            ach.id,
          ],
        );
        result.updated++;
      } else {
        await db.runAsync(
          `INSERT INTO achievements (
            id, name, description, icon, category, rarity, points,
            conditions, is_active, created_at, updated_at, _synced_at, _dirty, _deleted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
          [
            ach.id,
            ach.name,
            ach.description,
            ach.icon,
            ach.category,
            ach.rarity,
            ach.points,
            "{}", // conditions - API doesn't return this, use empty JSON
            ach.is_active ? 1 : 0,
            now, // created_at - API doesn't return this
            now, // updated_at
            now, // _synced_at
          ],
        );
        result.inserted++;
      }
    }

    await updateLastSyncAt(db, "achievements", now);
  } catch (error) {
    logger.error("[SyncManager] Pull achievements failed:", error);
  }

  return result;
}
