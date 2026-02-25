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
    adapted: (festivalId?: string) =>
      ["local-tents", festivalId, "adapted"] as const,
  },
  attendances: {
    all: (festivalId?: string) => ["local-attendances", festivalId] as const,
    byDate: (festivalId: string, date: string) =>
      ["local-attendances", festivalId, date] as const,
    adapted: (festivalId?: string) =>
      ["local-attendances", festivalId, "adapted"] as const,
    adaptedByDate: (festivalId: string, date: string) =>
      ["local-attendances", festivalId, date, "adapted-bydate"] as const,
  },
  consumptions: {
    byFestival: (festivalId?: string) =>
      ["local-consumptions", festivalId] as const,
    byDate: (festivalId: string, date: string) =>
      ["local-consumptions", festivalId, date] as const,
    byAttendance: (attendanceId?: string) =>
      ["local-consumptions", attendanceId] as const,
  },
  profile: {
    current: ["local-profile"] as const,
    byUser: (userId?: string) => ["local-profile", userId] as const,
  },
  groups: {
    all: (festivalId?: string) => ["local-groups", festivalId] as const,
    adapted: (festivalId?: string) =>
      ["local-groups", festivalId, "adapted"] as const,
  },
  achievements: {
    all: ["local-achievements"] as const,
  },
  userAchievements: {
    all: (festivalId?: string) =>
      ["local-user-achievements", festivalId] as const,
  },
  beerPictures: {
    byAttendance: (attendanceId?: string) =>
      ["local-beer-pictures", attendanceId] as const,
  },
} as const;

/** All local query key prefixes for bulk invalidation (e.g., pull-to-refresh) */
export const ALL_LOCAL_PREFIXES = [
  "local-attendances",
  "local-tents",
  "local-groups",
  "local-profile",
  "local-festivals",
  "local-consumptions",
  "local-achievements",
  "local-user-achievements",
  "local-beer-pictures",
] as const;
