/**
 * Offline-Aware Consumption Hooks
 *
 * Mobile-specific wrappers for consumption hooks that respect offline mode:
 * - When online: delegates to the original API-based hooks
 * - When offline: queues operations locally for later sync
 */

import { useOffline } from "@/lib/database/offline-provider";
import { enqueueOperation, generateUUID } from "@/lib/database/sync-queue";
import {
  useLogConsumption as useLogConsumptionApi,
  useDeleteConsumption as useDeleteConsumptionApi,
} from "@prostcounter/shared/hooks";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import type {
  LogConsumptionInput,
  Consumption,
} from "@prostcounter/shared/schemas";

/**
 * Offline-aware hook to log a new consumption
 * - Online: Makes API call directly
 * - Offline: Stores locally and queues for sync
 */
export function useOfflineLogConsumption() {
  const { isOnline, isReady, getDb, refreshPendingCount } = useOffline();
  const apiMutation = useLogConsumptionApi();

  const logConsumptionOffline = useCallback(
    async (input: LogConsumptionInput): Promise<Consumption | null> => {
      if (!isReady) {
        throw new Error("Database not ready");
      }

      const db = getDb();
      const now = new Date().toISOString();
      const consumptionId = generateUUID();

      // For offline mode, we only queue the operation for later sync
      // We don't write directly to consumptions table because:
      // 1. We don't have the attendance_id yet (API creates it)
      // 2. The schema requires fields we don't have offline
      // The sync manager will call the API when back online

      // Queue for sync
      await enqueueOperation(db, "INSERT", "consumptions", consumptionId, {
        ...input,
        id: consumptionId,
        recordedAt: now,
      });

      await refreshPendingCount();

      console.log(
        "[OfflineConsumption] Queued consumption locally:",
        consumptionId,
      );

      // Return a mock consumption object for optimistic UI
      return {
        id: consumptionId,
        attendanceId: consumptionId, // Placeholder - will be resolved on sync
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
    },
    [isReady, getDb, refreshPendingCount],
  );

  return useMutation({
    mutationFn: async (input: LogConsumptionInput) => {
      if (isOnline) {
        // Online: use API
        console.log("[OfflineConsumption] Online - calling API");
        return apiMutation.mutateAsync(input);
      } else {
        // Offline: queue locally
        console.log("[OfflineConsumption] Offline - queuing locally");
        return logConsumptionOffline(input);
      }
    },
    onSuccess: () => {
      // Invalidate queries handled by the underlying mutation or manual refresh
    },
  });
}

/**
 * Offline-aware hook to delete a consumption
 * - Online: Makes API call directly
 * - Offline: Marks as deleted locally and queues for sync
 */
export function useOfflineDeleteConsumption() {
  const { isOnline, isReady, getDb, refreshPendingCount } = useOffline();
  const apiMutation = useDeleteConsumptionApi();

  const deleteConsumptionOffline = useCallback(
    async (consumptionId: string): Promise<void> => {
      if (!isReady) {
        throw new Error("Database not ready");
      }

      const db = getDb();

      // Soft delete locally
      await db.runAsync(
        `UPDATE consumptions SET _deleted = 1, _dirty = 1 WHERE id = ?`,
        [consumptionId],
      );

      // Queue for sync
      await enqueueOperation(db, "DELETE", "consumptions", consumptionId, {
        id: consumptionId,
      });

      await refreshPendingCount();

      console.log(
        "[OfflineConsumption] Queued deletion locally:",
        consumptionId,
      );
    },
    [isReady, getDb, refreshPendingCount],
  );

  return useMutation({
    mutationFn: async (consumptionId: string) => {
      if (isOnline) {
        // Online: use API
        console.log("[OfflineConsumption] Online - calling API for delete");
        return apiMutation.mutateAsync(consumptionId);
      } else {
        // Offline: queue locally
        console.log("[OfflineConsumption] Offline - queuing delete locally");
        return deleteConsumptionOffline(consumptionId);
      }
    },
  });
}
