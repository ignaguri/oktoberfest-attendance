/**
 * Offline Database Hooks
 *
 * Custom hooks for offline-first data access:
 * - useOfflineQuery: Query local SQLite with background sync
 * - useOfflineMutation: Optimistic mutations with queue
 * - Table-specific hooks for attendances, consumptions, etc.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useEffect } from "react";

import type {
  LocalAttendance,
  LocalConsumption,
  LocalFestival,
  LocalTent,
  LocalProfile,
  LocalGroup,
  LocalAchievement,
  LocalUserAchievement,
} from "./schema";

import { useOffline } from "./offline-provider";
import {
  enqueueOperation,
  generateUUID,
  generateConsumptionIdempotencyKey,
} from "./sync-queue";

// =============================================================================
// Types
// =============================================================================

export type QueryKeyPrefix =
  | "local-festivals"
  | "local-tents"
  | "local-attendances"
  | "local-consumptions"
  | "local-profile"
  | "local-groups"
  | "local-achievements"
  | "local-user-achievements";

// =============================================================================
// Generic Offline Query Hook
// =============================================================================

interface UseOfflineQueryOptions<T> extends Omit<
  UseQueryOptions<T, Error>,
  "queryKey" | "queryFn"
> {
  /** Query key prefix for cache management */
  queryKeyPrefix: QueryKeyPrefix;
  /** Additional query key parts */
  queryKeyParts?: (string | number | undefined)[];
  /** SQL query to execute */
  sql: string;
  /** SQL parameters */
  params?: (string | number | null | undefined)[];
  /** Transform function for query result */
  transform?: (rows: unknown[]) => T;
  /** Whether to trigger background sync after query */
  syncAfterQuery?: boolean;
}

/**
 * Hook for querying local SQLite database with optional background sync.
 * Falls back to empty array if database is not ready.
 */
export function useOfflineQuery<T = unknown[]>({
  queryKeyPrefix,
  queryKeyParts = [],
  sql,
  params = [],
  transform,
  syncAfterQuery = false,
  ...options
}: UseOfflineQueryOptions<T>) {
  const { isReady, getDb, sync, festivalId, userId } = useOfflineWithContext();

  const queryKey = [queryKeyPrefix, ...queryKeyParts.filter(Boolean)];

  const query = useQuery<T, Error>({
    queryKey,
    queryFn: async () => {
      if (!isReady) {
        return (transform ? transform([]) : []) as T;
      }

      const db = getDb();
      const rows = await db.getAllAsync(
        sql,
        params as (string | number | null)[],
      );

      return (transform ? transform(rows) : rows) as T;
    },
    enabled: isReady,
    staleTime: Infinity, // Local data never goes stale - we control invalidation
    ...options,
  });

  // Trigger background sync after initial query
  useEffect(() => {
    if (syncAfterQuery && query.isSuccess && isReady) {
      sync({ direction: "pull" }).catch(console.error);
    }
  }, [syncAfterQuery, query.isSuccess, isReady]);

  return query;
}

// =============================================================================
// Generic Offline Mutation Hook
// =============================================================================

interface UseOfflineMutationOptions<TData, TVariables> {
  /** Table name for sync queue */
  tableName: string;
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

/**
 * Internal hook to get offline context with proper typing.
 */
function useOfflineWithContext() {
  const offline = useOffline();
  return {
    ...offline,
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
  return useOfflineQuery<LocalFestival[]>({
    queryKeyPrefix: "local-festivals",
    sql: "SELECT * FROM festivals WHERE _deleted = 0 ORDER BY start_date DESC",
    syncAfterQuery: true,
  });
}

/**
 * Hook to get a single festival by ID.
 */
export function useLocalFestival(festivalId: string | undefined) {
  const { isReady, getDb } = useOffline();

  return useQuery<LocalFestival | null, Error>({
    queryKey: ["local-festivals", festivalId],
    queryFn: async () => {
      if (!isReady || !festivalId) return null;

      const db = getDb();
      return await db.getFirstAsync<LocalFestival>(
        "SELECT * FROM festivals WHERE id = ? AND _deleted = 0",
        [festivalId],
      );
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
  return useOfflineQuery<LocalTent[]>({
    queryKeyPrefix: "local-tents",
    queryKeyParts: [festivalId],
    sql: "SELECT * FROM tents WHERE _deleted = 0 ORDER BY name ASC",
    enabled: !!festivalId,
    syncAfterQuery: true,
  });
}

// =============================================================================
// Attendance Hooks
// =============================================================================

/**
 * Hook to get attendances for a festival.
 */
export function useLocalAttendances(festivalId: string | undefined) {
  return useOfflineQuery<LocalAttendance[]>({
    queryKeyPrefix: "local-attendances",
    queryKeyParts: [festivalId],
    sql: `SELECT * FROM attendances
          WHERE festival_id = ? AND _deleted = 0
          ORDER BY date DESC`,
    params: [festivalId],
    enabled: !!festivalId,
    syncAfterQuery: true,
  });
}

/**
 * Hook to get attendance for a specific date.
 */
export function useLocalAttendanceByDate(
  festivalId: string | undefined,
  date: string | undefined,
) {
  const { isReady, getDb } = useOffline();

  return useQuery<LocalAttendance | null, Error>({
    queryKey: ["local-attendances", festivalId, date],
    queryFn: async () => {
      if (!isReady || !festivalId || !date) return null;

      const db = getDb();
      return await db.getFirstAsync<LocalAttendance>(
        "SELECT * FROM attendances WHERE festival_id = ? AND date = ? AND _deleted = 0",
        [festivalId, date],
      );
    },
    enabled: isReady && !!festivalId && !!date,
    staleTime: Infinity,
  });
}

/**
 * Hook to create or update an attendance.
 */
export function useLocalSaveAttendance() {
  const { isReady, getDb, refreshPendingCount } = useOffline();
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
        queryKey: ["local-attendances", data.festival_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["local-attendances", data.festival_id, data.date],
      });
    },
  });
}

/**
 * Hook to delete an attendance.
 */
export function useLocalDeleteAttendance() {
  const { isReady, getDb, refreshPendingCount } = useOffline();
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
          queryKey: ["local-attendances", festivalId],
        });
        queryClient.invalidateQueries({
          queryKey: ["local-consumptions", festivalId],
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
  return useOfflineQuery<LocalConsumption[]>({
    queryKeyPrefix: "local-consumptions",
    queryKeyParts: [attendanceId],
    sql: `SELECT * FROM consumptions
          WHERE attendance_id = ? AND _deleted = 0
          ORDER BY recorded_at DESC`,
    params: [attendanceId],
    enabled: !!attendanceId,
  });
}

/**
 * Hook to get consumptions for a festival and date.
 */
export function useLocalConsumptionsByDate(
  festivalId: string | undefined,
  date: string | undefined,
) {
  const { isReady, getDb } = useOffline();

  return useQuery<LocalConsumption[], Error>({
    queryKey: ["local-consumptions", festivalId, date],
    queryFn: async () => {
      if (!isReady || !festivalId || !date) return [];

      const db = getDb();
      // Join with attendances to filter by festival and date
      const consumptions = await db.getAllAsync<LocalConsumption>(
        `SELECT c.* FROM consumptions c
         INNER JOIN attendances a ON c.attendance_id = a.id
         WHERE a.festival_id = ? AND a.date = ? AND c._deleted = 0
         ORDER BY c.recorded_at DESC`,
        [festivalId, date],
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
 */
export function useLocalLogConsumption() {
  const { isReady, getDb, refreshPendingCount } = useOffline();
  const queryClient = useQueryClient();

  return useMutation<LocalConsumption, Error, LogConsumptionInput>({
    mutationFn: async (input) => {
      if (!isReady) {
        throw new Error("Database not ready");
      }

      const db = getDb();
      const now = new Date().toISOString();
      const id = generateUUID();
      // Note: Using attendance_id as user_id placeholder since we don't have user context here
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
        queryKey: ["local-consumptions", data.attendance_id],
      });
    },
  });
}

/**
 * Hook to delete a consumption.
 */
export function useLocalDeleteConsumption() {
  const { isReady, getDb, refreshPendingCount } = useOffline();
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
        queryKey: ["local-consumptions", attendanceId],
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
  return useOfflineQuery<LocalProfile | null>({
    queryKeyPrefix: "local-profile",
    queryKeyParts: [userId],
    sql: "SELECT * FROM profiles WHERE id = ? AND _deleted = 0",
    params: [userId],
    enabled: !!userId,
    transform: (rows) => (rows[0] as LocalProfile) ?? null,
    syncAfterQuery: true,
  });
}

// =============================================================================
// Achievement Hooks
// =============================================================================

/**
 * Hook to get all achievements.
 */
export function useLocalAchievements() {
  return useOfflineQuery<LocalAchievement[]>({
    queryKeyPrefix: "local-achievements",
    sql: "SELECT * FROM achievements WHERE _deleted = 0 AND is_active = 1 ORDER BY points DESC",
    syncAfterQuery: true,
  });
}

/**
 * Hook to get user's unlocked achievements.
 */
export function useLocalUserAchievements(festivalId: string | undefined) {
  return useOfflineQuery<LocalUserAchievement[]>({
    queryKeyPrefix: "local-user-achievements",
    queryKeyParts: [festivalId],
    sql: `SELECT * FROM user_achievements
          WHERE festival_id = ? AND _deleted = 0
          ORDER BY unlocked_at DESC`,
    params: [festivalId],
    enabled: !!festivalId,
    syncAfterQuery: true,
  });
}

// =============================================================================
// Group Hooks
// =============================================================================

/**
 * Hook to get groups for a festival.
 */
export function useLocalGroups(festivalId: string | undefined) {
  return useOfflineQuery<LocalGroup[]>({
    queryKeyPrefix: "local-groups",
    queryKeyParts: [festivalId],
    sql: `SELECT * FROM groups
          WHERE festival_id = ? AND _deleted = 0
          ORDER BY created_at DESC`,
    params: [festivalId],
    enabled: !!festivalId,
    syncAfterQuery: true,
  });
}
