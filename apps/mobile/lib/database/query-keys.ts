/**
 * Typed query key factories for TanStack React Query.
 *
 * All local (SQLite) query keys are centralized here to avoid scattered
 * string literals and enable type-safe cache invalidation.
 *
 * Usage:
 *   useQuery({ queryKey: localKeys.attendances.all(festivalId), ... })
 *   queryClient.invalidateQueries({ queryKey: localKeys.attendances.all() })
 */

export const localKeys = {
  festivals: {
    all: ["local-festivals"] as const,
    byId: (id: string) => ["local-festivals", id] as const,
  },
  tents: {
    all: (festivalId?: string) => ["local-tents", festivalId] as const,
    adapted: (festivalId?: string) => ["local-tents", festivalId, "adapted"] as const,
  },
  attendances: {
    all: (festivalId?: string) => ["local-attendances", festivalId] as const,
    byDate: (festivalId: string, date: string) => ["local-attendances", festivalId, date] as const,
    adapted: (festivalId?: string) => ["local-attendances", festivalId, "adapted"] as const,
    adaptedByDate: (festivalId: string, date: string) =>
      ["local-attendances", festivalId, date, "adapted-bydate"] as const,
  },
  daySummaries: {
    byFestival: (festivalId?: string) => ["local-day-summaries", festivalId] as const,
  },
  consumptions: {
    byFestival: (festivalId?: string) => ["local-consumptions", festivalId] as const,
    byDate: (festivalId: string, date: string) => ["local-consumptions", festivalId, date] as const,
    byAttendance: (attendanceId?: string) => ["local-consumptions", attendanceId] as const,
  },
  profile: {
    current: ["local-profile"] as const,
    byUser: (userId?: string) => ["local-profile", userId] as const,
  },
  groups: {
    all: (festivalId?: string) => ["local-groups", festivalId] as const,
    adapted: (festivalId?: string) => ["local-groups", festivalId, "adapted"] as const,
  },
  achievements: {
    all: ["local-achievements"] as const,
  },
  beerPictures: {
    byAttendance: (attendanceId?: string) => ["local-beer-pictures", attendanceId] as const,
  },
} as const;

/**
 * Prefixes every consumption write has to invalidate.
 *
 * A drink does not only change the consumption list. `local-attendances` carries
 * the per-day SUM of price_paid/base/tip that the Festival Summary spending
 * figures read, and `local-day-summaries` carries the per-row drink counts, so
 * invalidating only `local-consumptions` leaves both showing pre-write numbers
 * until an unrelated sync happens to refresh them.
 *
 * Shared so the log, delete and bulk-save paths cannot drift apart again: the
 * log path used to invalidate two consumption keys and nothing else, which is
 * how the summary tips value went stale after logging a drink.
 */
export const CONSUMPTION_WRITE_PREFIXES = [
  "local-consumptions",
  "local-attendances",
  "local-day-summaries",
] as const;

/** All local query key prefixes for bulk invalidation (e.g., pull-to-refresh) */
export const ALL_LOCAL_PREFIXES = [
  "local-attendances",
  "local-day-summaries",
  "local-tents",
  "local-groups",
  "local-profile",
  "local-festivals",
  "local-consumptions",
  "local-achievements",
  "local-user-achievements",
  "local-beer-pictures",
] as const;

/**
 * Invalidate all local SQLite query caches.
 * Use after bulk operations or sync. For single mutations, prefer targeted invalidation.
 */
export async function invalidateAllLocalQueries(queryClient: {
  invalidateQueries: (opts: { queryKey: string[] }) => Promise<void>;
}): Promise<void> {
  await Promise.all(
    ALL_LOCAL_PREFIXES.map((prefix) => queryClient.invalidateQueries({ queryKey: [prefix] })),
  );
}

/**
 * Invalidate specific local query key prefixes.
 */
export async function invalidateLocalQueries(
  queryClient: {
    invalidateQueries: (opts: { queryKey: string[] }) => Promise<void>;
  },
  prefixes: readonly string[],
): Promise<void> {
  await Promise.all(
    prefixes.map((prefix) => queryClient.invalidateQueries({ queryKey: [prefix] })),
  );
}
