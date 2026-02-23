/**
 * Adapted Offline Hooks
 *
 * Adapter layer that wraps local SQLite hooks (useLocalXxx) and transforms
 * their output to match the shared API hooks' return types (DataQueryResult<T>).
 *
 * This enables screens to switch from API-first to offline-first data access
 * by changing only their import path — no structural changes needed.
 */

import type { DataQueryResult } from "@prostcounter/shared/data";
import type { TentGroup } from "@prostcounter/shared/hooks";
import type {
  AttendanceByDate,
  AttendanceWithTotals,
  GroupWithMembers,
  WinningCriteria,
} from "@prostcounter/shared/schemas";
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useCallback, useContext, useMemo } from "react";

import { logger } from "@/lib/logger";

import { useLocalProfile, useLocalTents } from "./hooks";
import { OfflineContext } from "./offline-provider";
import type { LocalProfile, LocalTent } from "./schema";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert a TanStack Query result to the DataQueryResult interface
 * that all shared hooks and screens expect.
 */
function toDataQueryResult<T>(
  query: UseQueryResult<T, Error>,
): DataQueryResult<T> {
  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isInitialLoading: query.isLoading && !query.data,
    isRefetching: query.isRefetching,
  };
}

/**
 * Get offline context values safely. Returns isReady=false if outside provider.
 */
function useOfflineContext() {
  const context = useContext(OfflineContext);
  return {
    isReady: context?.isReady ?? false,
    getDb: context?.getDb,
  };
}

/**
 * Convert SQLite integer boolean (0/1/null) to JS boolean | null.
 */
function sqliteBoolToJs(value: number | null): boolean | null {
  if (value === null) return null;
  return value === 1;
}

/**
 * Group flat LocalTent[] into TentGroup[] format.
 * Mirrors the grouping logic in packages/shared/src/hooks/useTents.ts:48-76.
 */
function groupLocalTents(tents: LocalTent[]): TentGroup[] {
  return tents.reduce((acc: TentGroup[], tent) => {
    const category = tent.category
      ? tent.category.charAt(0).toUpperCase() + tent.category.slice(1)
      : "Uncategorized";

    const existing = acc.find((g) => g.category === category);

    if (existing) {
      existing.options.push({ value: tent.id, label: tent.name });
    } else {
      acc.push({
        category,
        options: [{ value: tent.id, label: tent.name }],
      });
    }

    return acc;
  }, []);
}

/**
 * Map winning_criteria_id (stored as string in SQLite) to WinningCriteria enum.
 */
function mapWinningCriteria(value: string | number): WinningCriteria {
  const str = String(value);
  switch (str) {
    case "1":
    case "days_attended":
      return "days_attended";
    case "3":
    case "avg_beers":
      return "avg_beers";
    default:
      return "total_beers";
  }
}

// =============================================================================
// Sync + Refresh Hook
// =============================================================================

/**
 * All local query key prefixes used by adapted hooks.
 * Invalidating these forces TanStack Query to re-read from SQLite.
 */
const LOCAL_QUERY_KEY_PREFIXES = [
  "local-attendances",
  "local-tents",
  "local-groups",
  "local-profile",
  "local-festivals",
];

/**
 * Hook that provides a "sync then refresh" function for pull-to-refresh.
 *
 * The adapted hooks read from local SQLite, so pull-to-refresh must:
 * 1. Pull fresh data from the API into SQLite (via SyncManager)
 * 2. Invalidate all local TanStack Query caches so hooks re-read from SQLite
 *
 * Use this in any screen that uses adapted hooks and supports pull-to-refresh.
 *
 * @example
 * const { syncAndRefresh, isSyncing } = useSyncRefresh();
 * <RefreshControl refreshing={isSyncing} onRefresh={syncAndRefresh} />
 */
export function useSyncRefresh() {
  const context = useContext(OfflineContext);
  const queryClient = useQueryClient();

  const syncAndRefresh = useCallback(async () => {
    try {
      // Step 1: Pull fresh data from API into SQLite
      if (context?.isOnline && context?.sync) {
        await context.sync({ direction: "pull" });
      }
    } catch (error) {
      logger.error("[useSyncRefresh] Sync pull failed:", error);
    }

    // Step 2: Invalidate all local query caches (always, even if sync fails)
    // This forces adapted hooks to re-read current SQLite state
    await Promise.all(
      LOCAL_QUERY_KEY_PREFIXES.map((prefix) =>
        queryClient.invalidateQueries({ queryKey: [prefix] }),
      ),
    );
  }, [context, queryClient]);

  return {
    syncAndRefresh,
    isSyncing: context?.syncStatus === "syncing",
  };
}

// =============================================================================
// Adapted Tent Hook
// =============================================================================

/**
 * Offline-first replacement for useTents().
 * Reads from local SQLite, groups tents by category.
 * Returns the same shape as the shared useTents hook.
 */
export function useAdaptedTents(festivalId?: string) {
  const query = useLocalTents(festivalId);

  const groupedTents = useMemo(() => {
    if (!query.data) return [];
    return groupLocalTents(query.data);
  }, [query.data]);

  return {
    tents: groupedTents,
    rawTents: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    isInitialLoading: query.isLoading && !query.data,
    isRefetching: query.isRefetching,
  };
}

// =============================================================================
// Adapted Attendance Hooks
// =============================================================================

/** Raw row shape from the attendance + consumption JOIN query */
interface AttendanceRow {
  id: string;
  user_id: string;
  festival_id: string;
  date: string;
  beer_count: number;
  created_at: string | null;
  updated_at: string | null;
  drinkCount: number;
  totalSpentCents: number;
  totalBaseCents: number;
  totalTipCents: number;
}

/**
 * Transform a raw SQL row into AttendanceWithTotals.
 */
function rowToAttendanceWithTotals(row: AttendanceRow): AttendanceWithTotals {
  const drinkCount = row.drinkCount ?? 0;
  const totalSpentCents = row.totalSpentCents ?? 0;
  return {
    id: row.id,
    userId: row.user_id,
    festivalId: row.festival_id,
    date: row.date,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    drinkCount,
    beerCount: row.beer_count ?? 0,
    totalSpentCents,
    totalBaseCents: row.totalBaseCents ?? 0,
    totalTipCents: row.totalTipCents ?? 0,
    avgPriceCents:
      drinkCount > 0 ? Math.round(totalSpentCents / drinkCount) : 0,
    tentVisits: [],
  };
}

const ATTENDANCES_WITH_TOTALS_SQL = `
  SELECT
    a.id, a.user_id, a.festival_id, a.date, a.beer_count,
    a.created_at, a.updated_at,
    COALESCE(COUNT(c.id), 0) as drinkCount,
    COALESCE(SUM(c.price_paid_cents), 0) as totalSpentCents,
    COALESCE(SUM(c.base_price_cents), 0) as totalBaseCents,
    COALESCE(SUM(c.tip_cents), 0) as totalTipCents
  FROM attendances a
  LEFT JOIN consumptions c ON c.attendance_id = a.id AND c._deleted = 0
  WHERE a.festival_id = ? AND a._deleted = 0
  GROUP BY a.id
  ORDER BY a.date DESC
`;

/**
 * Offline-first replacement for useAttendances().
 * Reads from local SQLite with JOIN to compute consumption totals.
 */
export function useAdaptedAttendances(
  festivalId: string | undefined,
): DataQueryResult<AttendanceWithTotals[]> {
  const { isReady, getDb } = useOfflineContext();

  const query = useQuery<AttendanceWithTotals[], Error>({
    queryKey: ["local-attendances", festivalId, "adapted"],
    queryFn: async () => {
      if (!isReady || !getDb || !festivalId) return [];
      const db = getDb();
      const rows = await db.getAllAsync<AttendanceRow>(
        ATTENDANCES_WITH_TOTALS_SQL,
        [festivalId],
      );
      return rows.map(rowToAttendanceWithTotals);
    },
    enabled: isReady && !!festivalId,
    staleTime: Infinity,
  });

  return toDataQueryResult(query);
}

/**
 * Offline-first replacement for useAttendanceByDate().
 * Reads from local SQLite with JOIN for totals + tent_visits for tentIds.
 */
export function useAdaptedAttendanceByDate(
  festivalId: string | undefined,
  date: string | undefined,
): DataQueryResult<AttendanceByDate | null> {
  const { isReady, getDb } = useOfflineContext();

  const query = useQuery<AttendanceByDate | null, Error>({
    queryKey: ["local-attendances", festivalId, date, "adapted-bydate"],
    queryFn: async () => {
      if (!isReady || !getDb || !festivalId || !date) return null;
      const db = getDb();

      // Get attendance with consumption totals
      const row = await db.getFirstAsync<AttendanceRow>(
        `SELECT
          a.id, a.user_id, a.festival_id, a.date, a.beer_count,
          a.created_at, a.updated_at,
          COALESCE(COUNT(c.id), 0) as drinkCount,
          COALESCE(SUM(c.price_paid_cents), 0) as totalSpentCents,
          COALESCE(SUM(c.base_price_cents), 0) as totalBaseCents,
          COALESCE(SUM(c.tip_cents), 0) as totalTipCents
        FROM attendances a
        LEFT JOIN consumptions c ON c.attendance_id = a.id AND c._deleted = 0
        WHERE a.festival_id = ? AND a.date = ? AND a._deleted = 0
        GROUP BY a.id`,
        [festivalId, date],
      );

      if (!row) return null;

      // Get tent IDs from tent_visits for this date
      const tentVisitRows = await db.getAllAsync<{ tent_id: string }>(
        `SELECT DISTINCT tent_id FROM tent_visits
         WHERE festival_id = ? AND visit_date = ? AND _deleted = 0`,
        [festivalId, date],
      );

      const base = rowToAttendanceWithTotals(row);
      return {
        ...base,
        tentIds: tentVisitRows.map((tv) => tv.tent_id),
        pictureUrls: [],
        pictures: [],
      };
    },
    enabled: isReady && !!festivalId && !!date,
    staleTime: Infinity,
  });

  return toDataQueryResult(query);
}

// =============================================================================
// Adapted Profile Hook
// =============================================================================

/** Profile shape expected by screens (from packages/shared/src/hooks/useProfile.ts) */
interface ProfileCacheData {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  tutorial_completed: boolean | null;
  tutorial_completed_at: string | null;
  updated_at: string | null;
}

/**
 * Convert LocalProfile (SQLite) to ProfileCacheData (screen-expected shape).
 */
function adaptLocalProfile(local: LocalProfile): ProfileCacheData {
  return {
    id: local.id,
    username: local.username,
    full_name: local.full_name,
    avatar_url: local.avatar_url,
    tutorial_completed: sqliteBoolToJs(local.tutorial_completed),
    tutorial_completed_at: local.tutorial_completed_at,
    updated_at: local.updated_at,
  };
}

/**
 * Offline-first replacement for useCurrentProfile().
 * Reads from local SQLite and converts types.
 */
export function useAdaptedProfile(
  userId: string | undefined,
): DataQueryResult<ProfileCacheData> {
  const query = useLocalProfile(userId);

  return {
    data: query.data ? adaptLocalProfile(query.data) : null,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isInitialLoading: query.isLoading && !query.data,
    isRefetching: query.isRefetching,
  };
}

// =============================================================================
// Adapted Groups Hook
// =============================================================================

/** Raw row shape from the groups + member count query */
interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  festival_id: string;
  created_by: string | null;
  invite_token: string | null;
  winning_criteria_id: string | number;
  created_at: string | null;
  member_count: number;
}

/**
 * Offline-first replacement for useUserGroups().
 * Reads from local SQLite with member count subquery.
 */
export function useAdaptedGroups(
  festivalId: string | undefined,
): DataQueryResult<GroupWithMembers[]> {
  const { isReady, getDb } = useOfflineContext();

  const query = useQuery<GroupWithMembers[], Error>({
    queryKey: ["local-groups", festivalId, "adapted"],
    queryFn: async () => {
      if (!isReady || !getDb || !festivalId) return [];
      const db = getDb();

      const rows = await db.getAllAsync<GroupRow>(
        `SELECT g.*,
          COALESCE((SELECT COUNT(*) FROM group_members gm
                    WHERE gm.group_id = g.id AND gm._deleted = 0), 0) as member_count
        FROM groups g
        WHERE g.festival_id = ? AND g._deleted = 0
        ORDER BY g.created_at DESC`,
        [festivalId],
      );

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        festivalId: row.festival_id,
        winningCriteria: mapWinningCriteria(row.winning_criteria_id),
        inviteToken: row.invite_token ?? "",
        createdBy: row.created_by ?? "",
        createdAt: row.created_at ?? new Date().toISOString(),
        updatedAt: row.created_at ?? new Date().toISOString(),
        memberCount: row.member_count ?? 0,
      }));
    },
    enabled: isReady && !!festivalId,
    staleTime: Infinity,
  });

  return toDataQueryResult(query);
}
