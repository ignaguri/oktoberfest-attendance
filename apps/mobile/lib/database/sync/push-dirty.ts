/**
 * Push Dirty Records
 *
 * Pushes locally-modified records that aren't tracked in the sync queue.
 * These are records with _dirty=1 that were modified directly (e.g., via hooks)
 * rather than going through the queue.
 */

import type * as SQLite from "expo-sqlite";

import { apiClient } from "../../api-client";
import type { LocalAttendance } from "../schema";
import { getDirtyRecords, markRecordClean } from "../sync-queue";
import type { PushResult } from "./types";

/**
 * Push dirty records that aren't in the queue
 */
export async function pushDirtyRecords(
  db: SQLite.SQLiteDatabase,
): Promise<PushResult[]> {
  const results: PushResult[] = [];
  const now = new Date().toISOString();

  // Push dirty attendances
  const dirtyAttendances = await getDirtyRecords<LocalAttendance>(
    db,
    "attendances",
  );
  for (const att of dirtyAttendances) {
    try {
      await apiClient.attendance.updatePersonal({
        festivalId: att.festival_id,
        date: att.date,
        amount: att.beer_count,
      });
      await markRecordClean(db, "attendances", att.id, now);
      results.push({ operationId: att.id, success: true });
    } catch (error) {
      results.push({
        operationId: att.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
