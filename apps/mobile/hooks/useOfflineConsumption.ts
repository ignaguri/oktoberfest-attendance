/**
 * Offline-Aware Consumption Hooks
 *
 * Mobile-specific wrappers for consumption hooks that respect offline mode:
 * - When online: delegates to the original API-based hooks
 * - When offline: queues operations locally for later sync
 */

import {
  useDeleteConsumption as useDeleteConsumptionApi,
  useLogConsumption as useLogConsumptionApi,
} from "@prostcounter/shared/hooks";
import type {
  Consumption,
  LogConsumptionInput,
} from "@prostcounter/shared/schemas";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useContext } from "react";

import { OfflineContext } from "@/lib/database/offline-provider";
import { enqueueOperation, generateUUID } from "@/lib/database/sync-queue";
import { logger } from "@/lib/logger";

/**
 * Offline-aware hook to log a new consumption
 * - Online: Makes API call directly
 * - Offline: Stores locally and queues for sync
 * - Falls back to online-only mode when OfflineDataProvider isn't available
 */
export function useOfflineLogConsumption() {
  const context = useContext(OfflineContext);
  const isOnline = context?.isOnline ?? true;
  const isReady = context?.isReady ?? false;
  const getDb = context?.getDb;
  const refreshPendingCount = context?.refreshPendingCount;
  const apiMutation = useLogConsumptionApi();

  const logConsumptionOffline = useCallback(
    async (input: LogConsumptionInput): Promise<Consumption | null> => {
      if (!isReady || !getDb || !refreshPendingCount) {
        throw new Error("Offline mode not available");
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

      logger.debug("[OfflineConsumption] Queued consumption locally:", {
        consumptionId,
      });

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
      // If online or offline mode not available, use API
      if (isOnline || !context) {
        logger.debug("[OfflineConsumption] Online - calling API");
        return apiMutation.mutateAsync(input);
      } else {
        // Offline: queue locally
        logger.debug("[OfflineConsumption] Offline - queuing locally");
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
 * - Falls back to online-only mode when OfflineDataProvider isn't available
 */
export function useOfflineDeleteConsumption() {
  const context = useContext(OfflineContext);
  const isOnline = context?.isOnline ?? true;
  const isReady = context?.isReady ?? false;
  const getDb = context?.getDb;
  const refreshPendingCount = context?.refreshPendingCount;
  const apiMutation = useDeleteConsumptionApi();

  const deleteConsumptionOffline = useCallback(
    async (consumptionId: string): Promise<void> => {
      if (!isReady || !getDb || !refreshPendingCount) {
        throw new Error("Offline mode not available");
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

      logger.debug("[OfflineConsumption] Queued deletion locally:", {
        consumptionId,
      });
    },
    [isReady, getDb, refreshPendingCount],
  );

  return useMutation({
    mutationFn: async (consumptionId: string) => {
      // If online or offline mode not available, use API
      if (isOnline || !context) {
        logger.debug("[OfflineConsumption] Online - calling API for delete");
        return apiMutation.mutateAsync(consumptionId);
      } else {
        // Offline: queue locally
        logger.debug("[OfflineConsumption] Offline - queuing delete locally");
        return deleteConsumptionOffline(consumptionId);
      }
    },
  });
}
