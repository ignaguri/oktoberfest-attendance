/**
 * Offline-Aware Attendance Hook
 *
 * Mobile-specific wrapper for the attendance update hook that respects offline mode:
 * - When online: delegates to the original API-based useUpdatePersonalAttendance
 * - When offline: writes to local SQLite and queues for sync
 *
 * This is needed because the shared useUpdatePersonalAttendance hook calls the API
 * directly, which hangs/fails when offline, blocking the entire save flow in
 * useSaveAttendance.
 */

import { useUpdatePersonalAttendance } from "@prostcounter/shared/hooks";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useContext } from "react";

import { useAuth } from "@/lib/auth/AuthContext";
import { OfflineContext } from "@/lib/database/offline-provider";
import type { LocalAttendance } from "@/lib/database/schema";
import { enqueueOperation, generateUUID } from "@/lib/database/sync-queue";
import { logger } from "@/lib/logger";

interface UpdateAttendanceInput {
  festivalId: string;
  date: string;
  amount: number;
  tents?: string[];
}

interface UpdateAttendanceResult {
  attendanceId: string;
  tentsAdded: string[];
  tentsRemoved: string[];
}

/**
 * Offline-aware hook to update personal attendance.
 * - Online: Makes API call directly via useUpdatePersonalAttendance
 * - Offline: Stores in local SQLite and queues for sync
 * - Falls back to online-only mode when OfflineDataProvider is not available
 */
export function useOfflineUpdateAttendance() {
  const context = useContext(OfflineContext);
  const isOnline = context?.isOnline ?? true;
  const isReady = context?.isReady ?? false;
  const getDb = context?.getDb;
  const refreshPendingCount = context?.refreshPendingCount;
  const apiMutation = useUpdatePersonalAttendance();
  const { user } = useAuth();

  const updateAttendanceOffline = useCallback(
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

      // Check if attendance already exists for this festival + date
      const existing = await db.getFirstAsync<LocalAttendance>(
        "SELECT * FROM attendances WHERE festival_id = ? AND date = ? AND _deleted = 0",
        [input.festivalId, input.date],
      );

      let attendanceId: string;

      if (existing) {
        // Update existing attendance
        attendanceId = existing.id;
        await db.runAsync(
          `UPDATE attendances SET
            beer_count = ?, updated_at = ?, _dirty = 1
          WHERE id = ?`,
          [input.amount, now, existing.id],
        );

        // Enqueue update operation for sync
        await enqueueOperation(db, "UPDATE", "attendances", existing.id, {
          festival_id: input.festivalId,
          date: input.date,
          beer_count: input.amount,
          tents: input.tents,
        });

        logger.debug("[OfflineAttendance] Updated existing attendance:", {
          attendanceId,
          beerCount: input.amount,
        });
      } else {
        // Insert new attendance
        attendanceId = generateUUID();
        await db.runAsync(
          `INSERT INTO attendances (
            id, user_id, festival_id, date, beer_count,
            created_at, updated_at, _synced_at, _dirty, _deleted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, 0)`,
          [
            attendanceId,
            userId,
            input.festivalId,
            input.date,
            input.amount,
            now,
            now,
          ],
        );

        // Enqueue insert operation for sync
        await enqueueOperation(db, "INSERT", "attendances", attendanceId, {
          festival_id: input.festivalId,
          date: input.date,
          beer_count: input.amount,
          tents: input.tents,
        });

        logger.debug("[OfflineAttendance] Created new attendance:", {
          attendanceId,
          beerCount: input.amount,
        });
      }

      await refreshPendingCount();

      // Return a result matching the API shape so callers (useSaveAttendance)
      // can use result.attendanceId for photo uploads
      return {
        attendanceId,
        tentsAdded: input.tents ?? [],
        tentsRemoved: [],
      };
    },
    [isReady, getDb, refreshPendingCount, user?.id],
  );

  return useMutation({
    mutationFn: async (
      input: UpdateAttendanceInput,
    ): Promise<UpdateAttendanceResult> => {
      // If online or offline mode not available, use API
      if (isOnline || !context) {
        logger.debug("[OfflineAttendance] Online - calling API");
        return apiMutation.mutateAsync(input);
      } else {
        // Offline: write locally and queue for sync
        logger.debug("[OfflineAttendance] Offline - saving locally");
        return updateAttendanceOffline(input);
      }
    },
  });
}
