/**
 * Local-First Consumption Hooks
 *
 * All mutations write to local SQLite first. Sync is NOT triggered here --
 * the orchestrator (useSaveAttendance) triggers a single push after all writes.
 */

import type {
  Consumption,
  LogConsumptionInput,
} from "@prostcounter/shared/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useContext } from "react";

import { useAuth } from "@/lib/auth/AuthContext";
import { OfflineContext } from "@/lib/database/offline-provider";
import { invalidateLocalQueries, localKeys } from "@/lib/database/query-keys";
import {
  enqueueOperation,
  generateUUID,
  getRecentConsumption,
  insertConsumptionLocally,
} from "@/lib/database/sync-queue";
import { logger } from "@/lib/logger";

type OfflineLogConsumptionInput = LogConsumptionInput & {
  skipDedup?: boolean;
  skipSideEffects?: boolean;
};

function buildConsumptionResult(
  id: string,
  attendanceId: string,
  input: LogConsumptionInput,
  now: string,
): Consumption {
  return {
    id,
    attendanceId,
    drinkType: input.drinkType,
    drinkName: input.drinkName ?? null,
    tentId: input.tentId ?? null,
    basePriceCents: input.basePriceCents ?? input.pricePaidCents,
    pricePaidCents: input.pricePaidCents,
    tipCents: null,
    volumeMl: input.volumeMl ?? 1000,
    recordedAt: now,
    createdAt: now,
    updatedAt: now,
  } as Consumption;
}

/**
 * Local-first hook to log a new consumption.
 * Always writes to SQLite first. Does not trigger sync -- caller is responsible.
 */
export function useOfflineLogConsumption() {
  const context = useContext(OfflineContext);
  const isReady = context?.isReady ?? false;
  const getDb = context?.getDb;
  const refreshPendingCount = context?.refreshPendingCount;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const logConsumptionLocal = useCallback(
    async (input: OfflineLogConsumptionInput): Promise<Consumption | null> => {
      if (!isReady || !getDb || !refreshPendingCount) {
        throw new Error("Offline mode not available");
      }

      const db = getDb();
      const now = new Date().toISOString();
      const consumptionId = generateUUID();

      const existing = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM attendances WHERE festival_id = ? AND date = ? AND _deleted = 0",
        [input.festivalId, input.date],
      );

      let attendanceId: string;

      if (existing) {
        attendanceId = existing.id;
      } else {
        // Auto-create attendance if it doesn't exist yet (e.g. quick-attendance flow)
        attendanceId = generateUUID();
        const userId = user?.id;
        if (!userId) {
          throw new Error("User not authenticated");
        }
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
          tents: [],
        });
      }

      // Deduplication: skip if same drink type was logged within 30 seconds
      if (!input.skipDedup) {
        const recentConsumption = await getRecentConsumption<{ id: string }>(
          db,
          attendanceId,
          input.drinkType,
          30,
        );

        if (recentConsumption) {
          logger.debug(
            "[OfflineConsumption] Deduplication: returning existing consumption",
            { id: recentConsumption.id },
          );
          return buildConsumptionResult(
            recentConsumption.id,
            attendanceId,
            input,
            now,
          );
        }
      }

      // Idempotency key prevents duplicate server-side creation during sync.
      // Stable per local row (consumptionId is the local UUID we just generated)
      // so retries of the same logical insert reuse the same key.
      const idempotencyKey = `${attendanceId}-${input.drinkType}-${consumptionId}`;

      await insertConsumptionLocally(db, {
        id: consumptionId,
        attendanceId,
        festivalId: input.festivalId,
        date: input.date,
        drinkType: input.drinkType,
        drinkName: input.drinkName,
        volumeMl: input.volumeMl ?? 1000,
        pricePaidCents: input.pricePaidCents,
        basePriceCents: input.basePriceCents,
        tentId: input.tentId,
        idempotencyKey,
        now,
      });

      if (!input.skipSideEffects) {
        await refreshPendingCount();

        queryClient.invalidateQueries({
          queryKey: localKeys.consumptions.byAttendance(attendanceId),
        });
        queryClient.invalidateQueries({
          queryKey: localKeys.consumptions.byDate(input.festivalId, input.date),
        });
      }

      logger.debug("[OfflineConsumption] Saved consumption locally:", {
        consumptionId,
        attendanceId,
      });

      return buildConsumptionResult(consumptionId, attendanceId, input, now);
    },
    [isReady, getDb, refreshPendingCount, queryClient, user?.id],
  );

  return useMutation({
    mutationFn: logConsumptionLocal,
  });
}

/**
 * Local-first hook to delete a consumption.
 * Always soft-deletes locally. Does not trigger sync -- caller is responsible.
 */
type DeleteConsumptionInput = {
  consumptionId: string;
  skipSideEffects?: boolean;
};

export function useOfflineDeleteConsumption() {
  const context = useContext(OfflineContext);
  const isReady = context?.isReady ?? false;
  const getDb = context?.getDb;
  const refreshPendingCount = context?.refreshPendingCount;
  const queryClient = useQueryClient();

  const deleteConsumptionLocal = useCallback(
    async (input: string | DeleteConsumptionInput): Promise<void> => {
      const consumptionId =
        typeof input === "string" ? input : input.consumptionId;
      const skipSideEffects =
        typeof input === "string" ? false : input.skipSideEffects;

      if (!isReady || !getDb || !refreshPendingCount) {
        throw new Error("Offline mode not available");
      }

      const db = getDb();
      const now = new Date().toISOString();

      await db.runAsync(
        "UPDATE consumptions SET _deleted = 1, _dirty = 1, updated_at = ? WHERE id = ?",
        [now, consumptionId],
      );

      await enqueueOperation(db, "DELETE", "consumptions", consumptionId, {
        id: consumptionId,
      });

      if (!skipSideEffects) {
        await refreshPendingCount();

        await invalidateLocalQueries(queryClient, [
          "local-consumptions",
          "local-attendances",
        ]);
      }

      logger.debug("[OfflineConsumption] Soft-deleted consumption locally:", {
        consumptionId,
      });
    },
    [isReady, getDb, refreshPendingCount, queryClient],
  );

  return useMutation({
    mutationFn: deleteConsumptionLocal,
  });
}
