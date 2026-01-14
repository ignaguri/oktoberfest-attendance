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
  static profile = (userId?: string) =>
    ["profile", userId ?? "current"] as const;
  static userStats = (userId: string, festivalId: string) =>
    ["user", userId, "stats", festivalId] as const;

  // Attendance queries
  static attendances = (festivalId: string) =>
    ["attendances", festivalId] as const;
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
  static groupMembers = (groupId: string) =>
    ["group", groupId, "members"] as const;
  static groupStats = (groupId: string, festivalId: string) =>
    ["group", groupId, "stats", festivalId] as const;
  static userGroups = (userId: string, festivalId: string) =>
    ["user", userId, "groups", festivalId] as const;
  static groupSearch = (name: string, festivalId: string) =>
    ["groups", "search", name, festivalId] as const;
  static groupGallery = (groupId: string) =>
    ["group", groupId, "gallery"] as const;

  // Leaderboard queries
  static globalLeaderboard = (criteriaId: number, festivalId: string) =>
    ["leaderboard", "global", criteriaId, festivalId] as const;
  static groupLeaderboard = (
    groupId: string,
    criteriaId: number,
    festivalId: string
  ) => ["leaderboard", "group", groupId, criteriaId, festivalId] as const;

  // Notification queries
  static notifications = () => ["notifications"] as const;
  static notificationPreferences = (userId: string) =>
    ["notifications", "preferences", userId] as const;

  // Achievement queries
  static achievements = () => ["achievements"] as const;
  static userAchievements = (userId: string, festivalId: string) =>
    ["achievements", "user", userId, festivalId] as const;

  // Activity feed queries
  static activityFeed = (festivalId: string) =>
    ["activity-feed", festivalId] as const;

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
  static festivalTents = (festivalId: string) =>
    ["festival-tents", festivalId] as const;
  static tentStats = (festivalId: string) =>
    ["tent-stats", festivalId] as const;

  // Wrapped queries
  static wrapped = (festivalId: string) => ["wrapped", festivalId] as const;
  static wrappedAccess = (festivalId: string) =>
    ["wrapped", "access", festivalId] as const;
  static availableWrapped = () => ["wrapped", "available"] as const;

  // Calendar queries
  static personalCalendar = (festivalId: string) =>
    ["calendar", "personal", festivalId] as const;
  static groupCalendar = (groupId: string) =>
    ["calendar", "group", groupId] as const;

  // Reservation queries
  static reservations = (festivalId: string) =>
    ["reservations", festivalId] as const;
  static reservation = (id: string) => ["reservation", id] as const;

  // Profile queries
  static tutorialStatus = () => ["tutorial-status"] as const;
  static missingProfileFields = () => ["missing-profile-fields"] as const;
  static highlights = (festivalId: string) =>
    ["highlights", festivalId] as const;
  static publicProfile = (userId: string, festivalId?: string) =>
    ["public-profile", userId, festivalId ?? "no-festival"] as const;

  // Miscellaneous
  static winningCriterias = () => ["winning-criterias"] as const;
}
