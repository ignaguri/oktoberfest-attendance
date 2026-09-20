/**
 * Query key factory for consistent cache key generation across web and mobile apps
 *
 * This class ensures all components use the same key format for the same data,
 * enabling proper cache sharing and invalidation patterns.
 */
export class QueryKeys {
  // Festival-related queries
  static festivals = () => ["festivals"] as const;
  static festival = (id: string) => ["festival", id] as const;
  static activeFestival = () => ["festival", "active"] as const;

  // User-related queries
  static user = () => ["user"] as const;
  static profile = (userId?: string) => ["profile", userId ?? "current"] as const;
  static userStats = (userId: string, festivalId: string) =>
    ["user", userId, "stats", festivalId] as const;

  // Attendance queries
  static attendances = (festivalId: string) => ["attendances", festivalId] as const;
  static attendance = (id: string) => ["attendance", id] as const;
  static attendanceByDate = (festivalId: string, date: string) =>
    ["attendanceByDate", festivalId, date] as const;

  // Consumption queries
  static consumptions = (festivalId: string, date: string) =>
    ["consumptions", festivalId, date] as const;
  static consumption = (id: string) => ["consumption", id] as const;

  // Group queries
  static groups = (festivalId: string) => ["groups", festivalId] as const;
  static group = (id: string) => ["group", id] as const;
  static groupMembers = (groupId: string) => ["group", groupId, "members"] as const;
  static groupStats = (groupId: string, festivalId: string) =>
    ["group", groupId, "stats", festivalId] as const;
  static userGroups = (userId: string, festivalId: string) =>
    ["user", userId, "groups", festivalId] as const;
  static groupSearch = (name: string, festivalId: string) =>
    ["groups", "search", name, festivalId] as const;
  /** Prefix covering every cached group search, for invalidation. */
  static groupSearchAll = () => ["groups", "search"] as const;
  static groupJoinRequestsIncoming = () => ["groups", "join-requests", "incoming"] as const;
  static groupGallery = (groupId: string) => ["group", groupId, "gallery"] as const;
  static carryOverCandidates = (festivalId: string) =>
    ["groups", "carry-over-candidates", festivalId] as const;
  static groupMessages = (groupId: string) => ["group-messages", groupId] as const;
  static messageFeed = (festivalId: string) => ["message-feed", festivalId] as const;

  // Leaderboard queries
  static globalLeaderboard = (criteriaId: number, festivalId: string) =>
    ["leaderboard", "global", criteriaId, festivalId] as const;
  static groupLeaderboard = (groupId: string, criteriaId: number, festivalId: string) =>
    ["leaderboard", "group", groupId, criteriaId, festivalId] as const;

  // Notification queries
  static notifications = () => ["notifications"] as const;
  static notificationPreferences = (userId: string) =>
    ["notifications", "preferences", userId] as const;

  // Achievement queries
  static achievements = () => ["achievements"] as const;
  static userAchievements = (userId: string, festivalId: string) =>
    ["achievements", "user", userId, festivalId] as const;
  static pendingUnlocks = () => ["achievements", "pending"] as const;

  // Activity feed queries
  static activityFeed = (festivalId: string) => ["activity-feed", festivalId] as const;

  // Location sharing queries
  static locationSharingPreferences = (festivalId: string) =>
    ["location-sharing", "preferences", festivalId] as const;
  static nearbyGroupMembers = (festivalId: string, radiusMeters: number) =>
    ["location-sharing", "nearby", festivalId, radiusMeters] as const;
  static activeLocation = (festivalId: string) =>
    ["location-sharing", "active", festivalId] as const;

  // Tent queries
  static tents = (festivalId: string) => ["tents", festivalId] as const;
  static allTents = () => ["tents", "all"] as const;
  static festivalTents = (festivalId: string) => ["festival-tents", festivalId] as const;
  static tentStats = (festivalId: string) => ["tent-stats", festivalId] as const;

  // Wrapped queries
  static wrapped = (festivalId: string) => ["wrapped", festivalId] as const;
  static wrappedAccess = (festivalId: string) => ["wrapped", "access", festivalId] as const;
  static availableWrapped = () => ["wrapped", "available"] as const;

  // Calendar queries
  static personalCalendar = (festivalId: string) => ["calendar", "personal", festivalId] as const;
  static groupCalendar = (groupId: string) => ["calendar", "group", groupId] as const;

  // Reservation queries
  static reservations = (festivalId: string) => ["reservations", festivalId] as const;
  static reservation = (id: string) => ["reservation", id] as const;

  // Day plan queries
  static dayPlans = (festivalId: string) => ["day-plans", festivalId] as const;
  static friendsGoing = (festivalId: string) => ["friends-going", festivalId] as const;
  static planCompanionOptions = (festivalId: string) =>
    ["plan-companion-options", festivalId] as const;
  static friendsWent = (festivalId: string, date: string) =>
    ["friends-went", festivalId, date] as const;

  // Profile queries
  static tutorialStatus = () => ["tutorial-status"] as const;
  static missingProfileFields = () => ["missing-profile-fields"] as const;
  static highlights = (festivalId: string) => ["highlights", festivalId] as const;
  static publicProfile = (userId: string, festivalId?: string) =>
    ["public-profile", userId, festivalId ?? "no-festival"] as const;

  // Photo social queries
  static photoReactions = (photoId: string, groupId: string) =>
    ["photo-reactions", photoId, groupId] as const;
  static photoComments = (photoId: string, groupId: string) =>
    ["photo-comments", photoId, groupId] as const;

  // Friend queries
  static friends = () => ["friends"] as const;
  static friendRequestsIncoming = () => ["friends", "requests", "incoming"] as const;
  static friendRequestsOutgoing = () => ["friends", "requests", "outgoing"] as const;
  static friendRequestCount = () => ["friends", "requests", "count"] as const;
  static friendSuggestions = () => ["friends", "suggestions"] as const;
  static friendSearch = (query: string) => ["friends", "search", query] as const;
  /** Prefix covering every cached search query, for invalidation. */
  static friendSearchAll = () => ["friends", "search"] as const;
  static friendshipStatus = (userId: string) => ["friends", "status", userId] as const;
  /** Prefix covering every cached status, for mutations that only know a friendship id. */
  static friendshipStatusAll = () => ["friends", "status"] as const;

  // Crowd report queries
  static crowdStatus = (festivalId: string) => ["crowd-status", festivalId] as const;
  static tentCrowdReports = (tentId: string, festivalId: string) =>
    ["crowd-reports", tentId, festivalId] as const;

  // Admin queries
  static adminUsers = (search?: string, page?: number) =>
    ["admin", "users", search ?? "", page ?? 1] as const;
  /** Prefix covering every cached user page, for invalidation after a mutation. */
  static adminUsersAll = () => ["admin", "users"] as const;
  static adminUser = (userId: string) => ["admin", "user", userId] as const;
  static adminUserAttendances = (userId: string) => ["admin", "user-attendances", userId] as const;
  /** Prefix covering every cached attendance list. */
  static adminUserAttendancesAll = () => ["admin", "user-attendances"] as const;
  static adminFestivals = () => ["admin", "festivals"] as const;
  static adminFestival = (festivalId: string) => ["admin", "festival", festivalId] as const;
  /**
   * Prefix covering every cached festival detail.
   *
   * Activating one festival deactivates the others server-side, so invalidating
   * only the edited row leaves the previously active festival's cached copy
   * still showing its Active badge.
   */
  static adminFestivalAll = () => ["admin", "festival"] as const;
  static adminGroups = () => ["admin", "groups"] as const;
  static adminGroup = (groupId: string) => ["admin", "group", groupId] as const;
  static adminGroupMembers = (groupId: string) => ["admin", "group", groupId, "members"] as const;
  static adminWinningCriteria = () => ["admin", "winning-criteria"] as const;
  static adminTents = () => ["admin", "tents"] as const;
  static adminFestivalTents = (festivalId: string) =>
    ["admin", "festival", festivalId, "tents"] as const;
  static adminFestivalTentsAvailable = (festivalId: string) =>
    ["admin", "festival", festivalId, "tents-available"] as const;
  static adminLocationSessions = (filters?: {
    festivalId?: string;
    userId?: string;
    includeExpired?: boolean;
  }) =>
    [
      "admin",
      "location-sessions",
      filters?.festivalId ?? null,
      filters?.userId ?? null,
      filters?.includeExpired ?? false,
    ] as const;
  /** Prefix covering every cached session list, for invalidation after a mutation. */
  static adminLocationSessionsAll = () => ["admin", "location-sessions"] as const;

  // Miscellaneous
  static winningCriterias = () => ["winning-criterias"] as const;
}
