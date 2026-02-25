/**
 * Offline Database Hooks
 *
 * Custom hooks for offline-first data access:
 * - useOfflineMutation: Optimistic mutations with queue
 * - Table-specific hooks for attendances, consumptions, etc.
 *
 * All read queries use Drizzle ORM via centralized query helpers (queries.ts).
 * All query keys are managed via localKeys (query-keys.ts).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";

import { logger } from "@/lib/logger";

import { createDrizzleDb } from "./db";
import { OfflineContext } from "./offline-provider";
import {
  queryAchievements,
  queryAttendanceByDate,
  queryAttendancesByFestival,
  queryConsumptionsByAttendance,
  queryConsumptionsByDate,
  queryFestivalById,
  queryFestivals,
  queryGroupsByFestival,
  queryProfileById,
  queryTents,
  queryUserAchievementsByFestival,
} from "./queries";
import { localKeys } from "./query-keys";
import type {
  LocalAchievement,
  LocalAttendance,
  LocalConsumption,
  LocalFestival,
  LocalGroup,
  LocalProfile,
  LocalTent,
  LocalUserAchievement,
  SyncableTable,
} from "./schema";
import {
  enqueueOperation,
  generateConsumptionIdempotencyKey,
  generateUUID,
  getRecentConsumption,
} from "./sync-queue";

// =============================================================================
// Generic Offline Mutation Hook
// =============================================================================

interface UseOfflineMutationOptions<TData, TVariables> {
  /** Table name for sync queue */
  tableName: SyncableTable;
  /** Operation type */
  operation: "INSERT" | "UPDATE" | "DELETE";
  /** Function to execute local database operation */
  localMutation: (variables: TVariables) => Promise<TData>;
  /** Query keys to invalidate after mutation */
  invalidateKeys?: string[][];
  /** Whether to enqueue for server sync */
  syncToServer?: boolean;
  /** Function to build sync payload from variables */
  buildPayload?: (
    variables: TVariables,
    result: TData,
  ) => Record<string, unknown>;
  /** Depends on another operation ID */
  dependsOn?: string;
  /** Callback when mutation succeeds */
  onSuccess?: (data: TData) => void | Promise<void>;
  /** Callback when mutation fails */
  onError?: (error: Error) => void | Promise<void>;
}

/**
 * Hook for offline-first mutations with optimistic updates and sync queue.
 */
export function useOfflineMutation<TData = void, TVariables = void>({
  tableName,
  operation,
  localMutation,
  invalidateKeys = [],
  syncToServer = true,
  buildPayload,
  dependsOn,
  onSuccess: originalOnSuccess,
  onError: originalOnError,
}: UseOfflineMutationOptions<TData, TVariables>) {
  const { isReady, getDb, refreshPendingCount } = useOfflineWithContext();
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      if (!isReady) {
        throw new Error("Database not ready");
      }

      // Execute local mutation
      const result = await localMutation(variables);

      // Enqueue for server sync if enabled
      if (syncToServer) {
        const db = getDb();
        const payload = buildPayload
          ? buildPayload(variables, result)
          : (variables as Record<string, unknown>);
        const recordId = (result as { id?: string })?.id ?? generateUUID();

        await enqueueOperation(
          db,
          operation,
          tableName,
          recordId,
          payload,
          dependsOn ? { dependsOn } : undefined,
        );

        // Refresh pending count
        await refreshPendingCount();
      }

      return result;
    },
    onSuccess: async (data) => {
      // Invalidate relevant queries
      for (const key of invalidateKeys) {
        await queryClient.invalidateQueries({ queryKey: key });
      }

      // Call original onSuccess if provided
      if (originalOnSuccess) {
        await originalOnSuccess(data);
      }
    },
    onError: async (error) => {
      if (originalOnError) {
        await originalOnError(error);
      }
    },
  });
}

// =============================================================================
// Helper Hook
// =============================================================================

// Stable default values for when context is unavailable
const DEFAULT_SYNC_RESULT = {
  success: false,
  direction: "both" as const,
  pulled: 0,
  pushed: 0,
  failed: 0,
  errors: ["OfflineDataProvider not available"],
  duration: 0,
};

const noopSync = async () => DEFAULT_SYNC_RESULT;
const noopAbort = () => {};
const noopGetDb = () => {
  throw new Error("OfflineDataProvider not available");
};
const noopGetSyncManager = () => {
  throw new Error("OfflineDataProvider not available");
};
const noopRefreshPendingCount = async () => {};
const noopSetSimulateOffline = () => {};

/**
 * Internal hook to safely get offline context.
 * Returns individual values to avoid object spreading issues.
 */
function useOfflineWithContext() {
  const context = useContext(OfflineContext);

  // Return individual values - primitives are stable, functions from context are stable
  return {
    isReady: context?.isReady ?? false,
    isOnline: context?.isOnline ?? true,
    syncStatus: context?.syncStatus ?? ("idle" as const),
    lastSyncResult: context?.lastSyncResult ?? null,
    pendingCount: context?.pendingCount ?? 0,
    lastSyncAt: context?.lastSyncAt ?? null,
    error: context?.error ?? null,
    sync: context?.sync ?? noopSync,
    abortSync: context?.abortSync ?? noopAbort,
    getDb: context?.getDb ?? noopGetDb,
    getSyncManager: context?.getSyncManager ?? noopGetSyncManager,
    refreshPendingCount:
      context?.refreshPendingCount ?? noopRefreshPendingCount,
    isSimulatingOffline: context?.isSimulatingOffline ?? false,
    setSimulateOffline: context?.setSimulateOffline ?? noopSetSimulateOffline,
    festivalId: undefined as string | undefined,
    userId: undefined as string | undefined,
  };
}

// =============================================================================
// Festival Hooks
// =============================================================================

/**
 * Hook to get all festivals from local database.
 */
export function useLocalFestivals() {
  const { isReady, getDb } = useOfflineWithContext();

  return useQuery<LocalFestival[], Error>({
    queryKey: localKeys.festivals.all,
    queryFn: async () => {
      if (!isReady) return [];
      const drizzleDb = createDrizzleDb(getDb());
      return await queryFestivals(drizzleDb);
    },
    enabled: isReady,
    staleTime: Infinity,
  });
}

/**
 * Hook to get a single festival by ID.
 */
export function useLocalFestival(festivalId: string | undefined) {
  const { isReady, getDb } = useOfflineWithContext();

  return useQuery<LocalFestival | null, Error>({
    queryKey: festivalId
      ? localKeys.festivals.byId(festivalId)
      : localKeys.festivals.all,
    queryFn: async () => {
      if (!isReady || !festivalId) return null;
      const drizzleDb = createDrizzleDb(getDb());
      return await queryFestivalById(drizzleDb, festivalId);
    },
    enabled: isReady && !!festivalId,
    staleTime: Infinity,
  });
}

// =============================================================================
// Tent Hooks
// =============================================================================

/**
 * Hook to get tents for a festival.
 */
export function useLocalTents(festivalId: string | undefined) {
  const { isReady, getDb } = useOfflineWithContext();

  return useQuery<LocalTent[], Error>({
    queryKey: localKeys.tents.all(festivalId),
    queryFn: async () => {
      if (!isReady) return [];
      const drizzleDb = createDrizzleDb(getDb());
      return await queryTents(drizzleDb);
    },
    enabled: isReady && !!festivalId,
    staleTime: Infinity,
  });
}

// =============================================================================
// Attendance Hooks
// =============================================================================

/**
 * Hook to get attendances for a festival.
 */
export function useLocalAttendances(festivalId: string | undefined) {
  const { isReady, getDb } = useOfflineWithContext();

  return useQuery<LocalAttendance[], Error>({
    queryKey: localKeys.attendances.all(festivalId),
    queryFn: async () => {
      if (!isReady || !festivalId) return [];
      const drizzleDb = createDrizzleDb(getDb());
      return await queryAttendancesByFestival(drizzleDb, festivalId);
    },
    enabled: isReady && !!festivalId,
    staleTime: Infinity,
  });
}

/**
 * Hook to get attendance for a specific date.
 */
export function useLocalAttendanceByDate(
  festivalId: string | undefined,
  date: string | undefined,
) {
  const { isReady, getDb } = useOfflineWithContext();

  return useQuery<LocalAttendance | null, Error>({
    queryKey:
      festivalId && date
        ? localKeys.attendances.byDate(festivalId, date)
        : ["local-attendances"],
    queryFn: async () => {
      if (!isReady || !festivalId || !date) return null;
      const drizzleDb = createDrizzleDb(getDb());
      return await queryAttendanceByDate(drizzleDb, festivalId, date);
    },
    enabled: isReady && !!festivalId && !!date,
    staleTime: Infinity,
  });
}

/**
 * Hook to create or update an attendance.
 */
export function useLocalSaveAttendance() {
  const { isReady, getDb, refreshPendingCount } = useOfflineWithContext();
  const queryClient = useQueryClient();

  return useMutation<
    LocalAttendance,
    Error,
    { festivalId: string; userId: string; date: string; beerCount: number }
  >({
    mutationFn: async ({ festivalId, userId, date, beerCount }) => {
      if (!isReady) {
        throw new Error("Database not ready");
      }

      const db = getDb();
      const now = new Date().toISOString();

      // Check if attendance exists
      const existing = await db.getFirstAsync<LocalAttendance>(
        "SELECT * FROM attendances WHERE festival_id = ? AND date = ? AND _deleted = 0",
        [festivalId, date],
      );

      let attendance: LocalAttendance;

      if (existing) {
        // Update existing
        await db.runAsync(
          `UPDATE attendances SET
            beer_count = ?, updated_at = ?, _dirty = 1
          WHERE id = ?`,
          [beerCount, now, existing.id],
        );

        attendance = {
          ...existing,
          beer_count: beerCount,
          updated_at: now,
          _dirty: 1,
        };

        // Enqueue update operation
        await enqueueOperation(db, "UPDATE", "attendances", existing.id, {
          festival_id: festivalId,
          date,
          beer_count: beerCount,
        });
      } else {
        // Insert new
        const id = generateUUID();
        await db.runAsync(
          `INSERT INTO attendances (
            id, user_id, festival_id, date, beer_count,
            created_at, updated_at, _synced_at, _dirty, _deleted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, 0)`,
          [id, userId, festivalId, date, beerCount, now, now],
        );

        attendance = {
          id,
          user_id: userId,
          festival_id: festivalId,
          date,
          beer_count: beerCount,
          created_at: now,
          updated_at: now,
          _synced_at: null,
          _dirty: 1,
          _deleted: 0,
        };

        // Enqueue insert operation
        await enqueueOperation(db, "INSERT", "attendances", id, {
          festival_id: festivalId,
          date,
          beer_count: beerCount,
        });
      }

      await refreshPendingCount();
      return attendance;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: localKeys.attendances.all(data.festival_id),
      });
      queryClient.invalidateQueries({
        queryKey: localKeys.attendances.byDate(data.festival_id, data.date),
      });
    },
  });
}

/**
 * Hook to delete an attendance.
 */
export function useLocalDeleteAttendance() {
  const { isReady, getDb, refreshPendingCount } = useOfflineWithContext();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { attendanceId: string; festivalId: string }>(
    {
      mutationFn: async ({ attendanceId, festivalId }) => {
        if (!isReady) {
          throw new Error("Database not ready");
        }

        const db = getDb();
        const now = new Date().toISOString();

        // Soft delete
        await db.runAsync(
          "UPDATE attendances SET _deleted = 1, _dirty = 1, updated_at = ? WHERE id = ?",
          [now, attendanceId],
        );

        // Also delete associated consumptions
        await db.runAsync(
          "UPDATE consumptions SET _deleted = 1, _dirty = 1, updated_at = ? WHERE attendance_id = ?",
          [now, attendanceId],
        );

        // Enqueue delete operation
        await enqueueOperation(db, "DELETE", "attendances", attendanceId, {});

        await refreshPendingCount();
      },
      onSuccess: (_, { festivalId }) => {
        queryClient.invalidateQueries({
          queryKey: localKeys.attendances.all(festivalId),
        });
        queryClient.invalidateQueries({
          queryKey: ["local-consumptions"],
        });
      },
    },
  );
}

// =============================================================================
// Consumption Hooks
// =============================================================================

/**
 * Hook to get consumptions for an attendance.
 */
export function useLocalConsumptions(attendanceId: string | undefined) {
  const { isReady, getDb } = useOfflineWithContext();

  return useQuery<LocalConsumption[], Error>({
    queryKey: localKeys.consumptions.byAttendance(attendanceId),
    queryFn: async () => {
      if (!isReady || !attendanceId) return [];
      const drizzleDb = createDrizzleDb(getDb());
      return await queryConsumptionsByAttendance(drizzleDb, attendanceId);
    },
    enabled: isReady && !!attendanceId,
    staleTime: Infinity,
  });
}

/**
 * Hook to get consumptions for a festival and date.
 */
export function useLocalConsumptionsByDate(
  festivalId: string | undefined,
  date: string | undefined,
) {
  const { isReady, getDb } = useOfflineWithContext();

  return useQuery<LocalConsumption[], Error>({
    queryKey:
      festivalId && date
        ? localKeys.consumptions.byDate(festivalId, date)
        : ["local-consumptions"],
    queryFn: async () => {
      if (!isReady || !festivalId || !date) return [];

      const drizzleDb = createDrizzleDb(getDb());
      const consumptions = await queryConsumptionsByDate(
        drizzleDb,
        festivalId,
        date,
      );
      return consumptions;
    },
    enabled: isReady && !!festivalId && !!date,
    staleTime: Infinity,
  });
}

export type DrinkType =
  | "beer"
  | "radler"
  | "alcohol_free"
  | "wine"
  | "soft_drink"
  | "other";

export interface LogConsumptionInput {
  attendanceId: string;
  festivalId: string;
  date: string;
  drinkType: DrinkType;
  drinkName?: string;
  volumeMl: number;
  pricePaidCents: number;
  basePriceCents?: number;
  tipCents?: number;
  tentId?: string;
}

/**
 * Hook to log a consumption.
 * Includes deduplication: if the same drink type was logged within 30 seconds
 * for the same attendance, returns the existing consumption instead of creating a duplicate.
 */
export function useLocalLogConsumption() {
  const { isReady, getDb, refreshPendingCount } = useOfflineWithContext();
  const queryClient = useQueryClient();

  return useMutation<LocalConsumption, Error, LogConsumptionInput>({
    mutationFn: async (input) => {
      if (!isReady) {
        throw new Error("Database not ready");
      }

      const db = getDb();

      // Check for recent duplicate consumption (within 30 seconds)
      const recentConsumption = await getRecentConsumption<LocalConsumption>(
        db,
        input.attendanceId,
        input.drinkType,
        30, // seconds
      );

      if (recentConsumption) {
        // Return existing consumption instead of creating a duplicate
        logger.debug(
          `[useLocalLogConsumption] Deduplication: returning existing consumption ${recentConsumption.id}`,
        );
        return recentConsumption;
      }

      const now = new Date().toISOString();
      const id = generateUUID();
      // Create unique idempotency key with timestamp for server sync
      const idempotencyKey = generateConsumptionIdempotencyKey(
        input.attendanceId, // userId placeholder
        input.festivalId,
        input.date,
        input.drinkType,
        Date.now(),
      );

      const consumption: LocalConsumption = {
        id,
        attendance_id: input.attendanceId,
        drink_type: input.drinkType,
        drink_name: input.drinkName ?? null,
        volume_ml: input.volumeMl,
        price_paid_cents: input.pricePaidCents,
        base_price_cents: input.basePriceCents ?? input.pricePaidCents,
        tip_cents: input.tipCents ?? null,
        tent_id: input.tentId ?? null,
        recorded_at: now,
        idempotency_key: idempotencyKey,
        created_at: now,
        updated_at: now,
        _synced_at: null,
        _dirty: 1,
        _deleted: 0,
      };

      await db.runAsync(
        `INSERT INTO consumptions (
          id, attendance_id, drink_type, drink_name, volume_ml,
          price_paid_cents, base_price_cents, tip_cents, tent_id,
          recorded_at, idempotency_key, created_at, updated_at,
          _synced_at, _dirty, _deleted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, 0)`,
        [
          id,
          input.attendanceId,
          input.drinkType,
          input.drinkName ?? null,
          input.volumeMl,
          input.pricePaidCents,
          input.basePriceCents ?? input.pricePaidCents,
          input.tipCents ?? null,
          input.tentId ?? null,
          now,
          idempotencyKey,
          now,
          now,
        ],
      );

      // Enqueue for server sync
      await enqueueOperation(
        db,
        "INSERT",
        "consumptions",
        id,
        {
          festival_id: input.festivalId,
          date: input.date,
          drink_type: input.drinkType,
          drink_name: input.drinkName,
          volume_ml: input.volumeMl,
          price_paid_cents: input.pricePaidCents,
          base_price_cents: input.basePriceCents,
          tip_cents: input.tipCents,
          tent_id: input.tentId,
        },
        { idempotencyKey },
      );

      await refreshPendingCount();
      return consumption;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: localKeys.consumptions.byAttendance(data.attendance_id),
      });
    },
  });
}

/**
 * Hook to delete a consumption.
 */
export function useLocalDeleteConsumption() {
  const { isReady, getDb, refreshPendingCount } = useOfflineWithContext();
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { consumptionId: string; attendanceId: string }
  >({
    mutationFn: async ({ consumptionId, attendanceId }) => {
      if (!isReady) {
        throw new Error("Database not ready");
      }

      const db = getDb();
      const now = new Date().toISOString();

      // Soft delete
      await db.runAsync(
        "UPDATE consumptions SET _deleted = 1, _dirty = 1, updated_at = ? WHERE id = ?",
        [now, consumptionId],
      );

      // Enqueue delete operation
      await enqueueOperation(db, "DELETE", "consumptions", consumptionId, {});

      await refreshPendingCount();
    },
    onSuccess: (_, { attendanceId }) => {
      queryClient.invalidateQueries({
        queryKey: localKeys.consumptions.byAttendance(attendanceId),
      });
    },
  });
}

// =============================================================================
// Profile Hooks
// =============================================================================

/**
 * Hook to get the current user's profile.
 */
export function useLocalProfile(userId: string | undefined) {
  const { isReady, getDb } = useOfflineWithContext();

  return useQuery<LocalProfile | null, Error>({
    queryKey: localKeys.profile.current,
    queryFn: async () => {
      if (!isReady || !userId) return null;
      const drizzleDb = createDrizzleDb(getDb());
      return await queryProfileById(drizzleDb, userId);
    },
    enabled: isReady && !!userId,
    staleTime: Infinity,
  });
}

// =============================================================================
// Achievement Hooks
// =============================================================================

/**
 * Hook to get all achievements.
 */
export function useLocalAchievements() {
  const { isReady, getDb } = useOfflineWithContext();

  return useQuery<LocalAchievement[], Error>({
    queryKey: localKeys.achievements.all,
    queryFn: async () => {
      if (!isReady) return [];
      const drizzleDb = createDrizzleDb(getDb());
      return await queryAchievements(drizzleDb);
    },
    enabled: isReady,
    staleTime: Infinity,
  });
}

/**
 * Hook to get user's unlocked achievements.
 */
export function useLocalUserAchievements(festivalId: string | undefined) {
  const { isReady, getDb } = useOfflineWithContext();

  return useQuery<LocalUserAchievement[], Error>({
    queryKey: localKeys.userAchievements.all(festivalId),
    queryFn: async () => {
      if (!isReady || !festivalId) return [];
      const drizzleDb = createDrizzleDb(getDb());
      return await queryUserAchievementsByFestival(drizzleDb, festivalId);
    },
    enabled: isReady && !!festivalId,
    staleTime: Infinity,
  });
}

// =============================================================================
// Group Hooks
// =============================================================================

/**
 * Hook to get groups for a festival.
 */
export function useLocalGroups(festivalId: string | undefined) {
  const { isReady, getDb } = useOfflineWithContext();

  return useQuery<LocalGroup[], Error>({
    queryKey: localKeys.groups.all(festivalId),
    queryFn: async () => {
      if (!isReady || !festivalId) return [];
      const drizzleDb = createDrizzleDb(getDb());
      return await queryGroupsByFestival(drizzleDb, festivalId);
    },
    enabled: isReady && !!festivalId,
    staleTime: Infinity,
  });
}
