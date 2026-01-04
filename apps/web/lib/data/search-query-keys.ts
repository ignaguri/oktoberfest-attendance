/**
 * Query key factory for search-related queries
 * Provides consistent query key generation for search functionality
 */

export interface BaseSearchFilters {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface UserSearchFilters extends BaseSearchFilters {
  isSuperAdmin?: boolean;
  hasProfile?: boolean;
  groupId?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface GroupSearchFilters extends BaseSearchFilters {
  hasMembers?: boolean;
  createdAfter?: string;
  createdBefore?: string;
}

export interface FestivalSearchFilters extends BaseSearchFilters {
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface TentSearchFilters extends BaseSearchFilters {
  festivalId?: string;
  isActive?: boolean;
  category?: string;
}

export const searchKeys = {
  all: ["search"] as const,

  // User search queries
  users: (filters: UserSearchFilters = {}) =>
    [...searchKeys.all, "users", filters] as const,
  user: (id: string) => [...searchKeys.all, "users", "detail", id] as const,
  userAttendances: (userId: string, filters: BaseSearchFilters = {}) =>
    [...searchKeys.all, "users", "attendances", userId, filters] as const,

  // Group search queries
  groups: (filters: GroupSearchFilters = {}) =>
    [...searchKeys.all, "groups", filters] as const,
  group: (id: string) => [...searchKeys.all, "groups", "detail", id] as const,
  groupMembers: (groupId: string, filters: BaseSearchFilters = {}) =>
    [...searchKeys.all, "groups", "members", groupId, filters] as const,

  // Festival search queries
  festivals: (filters: FestivalSearchFilters = {}) =>
    [...searchKeys.all, "festivals", filters] as const,
  festival: (id: string) =>
    [...searchKeys.all, "festivals", "detail", id] as const,

  // Tent search queries
  tents: (filters: TentSearchFilters = {}) =>
    [...searchKeys.all, "tents", filters] as const,
  tent: (id: string) => [...searchKeys.all, "tents", "detail", id] as const,

  // Global search
  global: (query: string, entityTypes: string[] = []) =>
    [...searchKeys.all, "global", query, entityTypes] as const,
} as const;

export type SearchQueryKey =
  | ReturnType<typeof searchKeys.users>
  | ReturnType<typeof searchKeys.groups>
  | ReturnType<typeof searchKeys.festivals>
  | ReturnType<typeof searchKeys.tents>
  | ReturnType<typeof searchKeys.global>;
