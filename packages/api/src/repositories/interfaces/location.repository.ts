import type {
  LocationPoint,
  LocationSession,
  LocationSessionMember,
  StartLocationSessionInput,
} from "@prostcounter/shared";

/**
 * Location repository interface
 * Provides data access for location sharing sessions
 */
export interface ILocationRepository {
  /**
   * Start a new location sharing session
   * @param userId - User ID starting the session
   * @param data - Session configuration
   * @returns Created session
   */
  startSession(
    userId: string,
    data: StartLocationSessionInput,
  ): Promise<LocationSession>;

  /**
   * Stop an active location session
   * @param sessionId - Session ID
   * @param userId - User ID (for authorization)
   * @returns Updated session
   */
  stopSession(sessionId: string, userId: string): Promise<LocationSession>;

  /**
   * Get active session for a user and festival
   * @param userId - User ID
   * @param festivalId - Festival ID
   * @returns Active session if exists
   */
  getActiveSession(
    userId: string,
    festivalId: string,
  ): Promise<LocationSession | null>;

  /**
   * Get all active sessions for a user
   * @param userId - User ID
   * @returns Array of active sessions
   */
  getActiveSessions(userId: string): Promise<LocationSession[]>;

  /**
   * Update location for a session
   * @param sessionId - Session ID
   * @param userId - User ID (for authorization)
   * @param location - New location data
   */
  updateLocation(
    sessionId: string,
    userId: string,
    location: LocationPoint,
  ): Promise<void>;

  /**
   * Get nearby group members sharing location
   * @param userId - Current user ID
   * @param festivalId - Festival ID
   * @param latitude - Current latitude
   * @param longitude - Current longitude
   * @param radiusMeters - Search radius in meters
   * @param groupId - Optional group filter
   * @returns Array of nearby members with their locations
   */
  getNearbyMembers(
    userId: string,
    festivalId: string,
    latitude: number,
    longitude: number,
    radiusMeters: number,
    groupId?: string,
  ): Promise<LocationSessionMember[]>;

  /**
   * Expire old location sessions
   * Cleanup function to mark expired sessions as inactive
   */
  expireOldSessions(): Promise<void>;

  // Admin methods

  /**
   * Get all active location sessions (admin only)
   * @param filters - Optional filters for festival, user, etc.
   * @returns Array of all active sessions with user info
   */
  getActiveSessionsAdmin(filters?: {
    festivalId?: string;
    userId?: string;
    includeExpired?: boolean;
  }): Promise<
    Array<
      LocationSession & {
        user: { id: string; username: string; fullName: string | null };
        festival: { id: string; name: string };
      }
    >
  >;

  /**
   * Force stop a session (admin only, bypasses user ownership)
   * @param sessionId - Session ID to stop
   * @returns Updated session
   */
  forceStopSession(sessionId: string): Promise<LocationSession>;

  /**
   * Cleanup expired sessions (admin only)
   * @returns Number of sessions cleaned up
   */
  cleanupExpiredSessions(): Promise<number>;
}
