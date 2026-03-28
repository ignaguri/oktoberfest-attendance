/**
 * Local-First Attendance Hook
 *
 * All mutations write to local SQLite first. Sync is NOT triggered here --
 * the orchestrator (useSaveAttendance) triggers a single push after all writes.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useContext } from "react";

import { useAuth } from "@/lib/auth/AuthContext";
import { OfflineContext } from "@/lib/database/offline-provider";
import { invalidateLocalQueries } from "@/lib/database/query-keys";
import type { LocalAttendance } from "@/lib/database/schema";
import { enqueueOperation, generateUUID } from "@/lib/database/sync-queue";
import { logger } from "@/lib/logger";

interface UpdateAttendanceInput {
  festivalId: string;
  date: string;
  amount?: number;
  tents?: string[];
}

interface UpdateAttendanceResult {
  attendanceId: string;
  tentsAdded: string[];
  tentsRemoved: string[];
}

/**
 * Local-first hook to update personal attendance.
 * Always writes to SQLite first. Does not trigger sync -- caller is responsible.
 */
export function useOfflineUpdateAttendance() {
  const context = useContext(OfflineContext);
  const isReady = context?.isReady ?? false;
  const getDb = context?.getDb;
  const refreshPendingCount = context?.refreshPendingCount;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const updateAttendanceLocal = useCallback(
    async (input: UpdateAttendanceInput): Promise<UpdateAttendanceResult> => {
      if (!isReady || !getDb || !refreshPendingCount) {
        throw new Error("Offline mode not available");
      }

      const userId = user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const db = getDb();
      const now = new Date().toISOString();

      const existing = await db.getFirstAsync<LocalAttendance>(
        "SELECT * FROM attendances WHERE festival_id = ? AND date = ? AND _deleted = 0",
        [input.festivalId, input.date],
      );

      let attendanceId: string;

      if (existing) {
        attendanceId = existing.id;
        await db.runAsync(
          `UPDATE attendances SET
            beer_count = 0, updated_at = ?, _dirty = 1
          WHERE id = ?`,
          [now, existing.id],
        );

        await enqueueOperation(db, "UPDATE", "attendances", existing.id, {
          festival_id: input.festivalId,
          date: input.date,
          beer_count: 0,
          tents: input.tents,
        });

        logger.debug("[OfflineAttendance] Updated existing attendance:", {
          attendanceId,
        });
      } else {
        attendanceId = generateUUID();
        await db.runAsync(
          `INSERT INTO attendances (
            id, user_id, festival_id, date, beer_count,
            created_at, updated_at, _synced_at, _dirty, _deleted
          ) VALUES (?, ?, ?, ?, 0, ?, ?, NULL, 1, 0)`,
          [attendanceId, userId, input.festivalId, input.date, now, now],
        );

        await enqueueOperation(db, "INSERT", "attendances", attendanceId, {
          festival_id: input.festivalId,
          date: input.date,
          beer_count: 0,
          tents: input.tents,
        });

        logger.debug("[OfflineAttendance] Created new attendance:", {
          attendanceId,
        });
      }

      // Write tent_visits locally so adapted hooks see them immediately
      if (input.tents && input.tents.length > 0) {
        for (const tentId of input.tents) {
          const visitId = generateUUID();
          await db.runAsync(
            `INSERT OR REPLACE INTO tent_visits (
              id, user_id, tent_id, festival_id, visit_date,
              _synced_at, _deleted, _dirty
            ) VALUES (
              COALESCE(
                (SELECT id FROM tent_visits WHERE user_id = ? AND tent_id = ? AND festival_id = ? AND visit_date = ?),
                ?
              ),
              ?, ?, ?, ?, NULL, 0, 1
            )`,
            [
              userId,
              tentId,
              input.festivalId,
              input.date,
              visitId,
              userId,
              tentId,
              input.festivalId,
              input.date,
            ],
          );
        }
      }

      await refreshPendingCount();

      await invalidateLocalQueries(queryClient, [
        "local-attendances",
        "local-tents",
        "local-consumptions",
      ]);

      return {
        attendanceId,
        tentsAdded: input.tents ?? [],
        tentsRemoved: [],
      };
    },
    [isReady, getDb, refreshPendingCount, queryClient, user?.id],
  );

  return useMutation({
    mutationFn: updateAttendanceLocal,
  });
}
