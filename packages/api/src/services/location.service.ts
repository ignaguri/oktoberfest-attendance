import type { ILocationRepository } from "../repositories/interfaces";
import type {
  LocationSession,
  LocationPoint,
  LocationSessionMember,
  StartLocationSessionInput,
} from "@prostcounter/shared";

import { ConflictError, ValidationError } from "../middleware/error";

/**
 * Location Service
 * Handles business logic for real-time location sharing
 */
export class LocationService {
  constructor(private locationRepo: ILocationRepository) {}

  /**
   * Start a new location sharing session
   *
   * Business Logic:
   * 1. Verify user doesn't already have active session for this festival
   * 2. Validate duration (min 5 minutes, max 8 hours)
   * 3. Create session
   * 4. TODO: Notify group members that user started sharing
   *
   * @param userId - User ID starting the session
   * @param data - Session configuration
   * @returns Created session
   */
  async startSession(
    userId: string,
    data: StartLocationSessionInput,
  ): Promise<LocationSession> {
    // Validate duration
    const duration = data.durationMinutes || 120;
    if (duration < 5 || duration > 480) {
      throw new ValidationError("Duration must be between 5 and 480 minutes");
    }

    // Check for existing active session
    const existing = await this.locationRepo.getActiveSession(
      userId,
      data.festivalId,
    );

    if (existing) {
      throw new ConflictError(
        "User already has an active location session for this festival",
      );
    }

    // Create session
    const session = await this.locationRepo.startSession(userId, data);

    // TODO: Notify group members
    // if (session) {
    //   await this.notificationService.notifyLocationSharingStarted(userId, data.festivalId);
    // }

    return session;
  }

  /**
   * Stop an active location session
   *
   * @param sessionId - Session ID
   * @param userId - User ID (for authorization)
   * @returns Updated session
   */
  async stopSession(
    sessionId: string,
    userId: string,
  ): Promise<LocationSession> {
    const session = await this.locationRepo.stopSession(sessionId, userId);

    // TODO: Optionally notify group members
    // await this.notificationService.notifyLocationSharingStopped(userId);

    return session;
  }

  /**
   * Get active session for a user and festival
   *
   * @param userId - User ID
   * @param festivalId - Festival ID
   * @returns Active session if exists
   */
  async getActiveSession(
    userId: string,
    festivalId: string,
  ): Promise<LocationSession | null> {
    return this.locationRepo.getActiveSession(userId, festivalId);
  }

  /**
   * Get all active sessions for a user
   *
   * @param userId - User ID
   * @returns Array of active sessions
   */
  async getActiveSessions(userId: string): Promise<LocationSession[]> {
    return this.locationRepo.getActiveSessions(userId);
  }

  /**
   * Update location for a session
   *
   * Business Logic:
   * 1. Verify session exists and is active
   * 2. Validate location data
   * 3. Update location
   * 4. Extend session expiry if close to expiring
   *
   * @param sessionId - Session ID
   * @param userId - User ID (for authorization)
   * @param location - New location data
   */
  async updateLocation(
    sessionId: string,
    userId: string,
    location: LocationPoint,
  ): Promise<void> {
    // Validate latitude/longitude
    if (
      location.latitude < -90 ||
      location.latitude > 90 ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      throw new ValidationError("Invalid latitude or longitude");
    }

    await this.locationRepo.updateLocation(sessionId, userId, location);

    // TODO: Optionally extend session if close to expiring
    // const session = await this.locationRepo.getActiveSession(...);
    // if (isCloseToExpiry(session)) {
    //   await this.extendSession(sessionId);
    // }
  }

  /**
   * Get nearby group members sharing location
   *
   * Business Logic:
   * 1. Validate search radius
   * 2. Get nearby members from database
   * 3. Filter out user's own location
   * 4. Sort by distance
   *
   * @param userId - Current user ID
   * @param festivalId - Festival ID
   * @param latitude - Current latitude
   * @param longitude - Current longitude
   * @param radiusMeters - Search radius in meters
   * @param groupId - Optional group filter
   * @returns Array of nearby members with their locations
   */
  async getNearbyMembers(
    userId: string,
    festivalId: string,
    latitude: number,
    longitude: number,
    radiusMeters: number,
    groupId?: string,
  ): Promise<LocationSessionMember[]> {
    // Validate radius
    if (radiusMeters < 100 || radiusMeters > 5000) {
      throw new ValidationError("Radius must be between 100 and 5000 meters");
    }

    // Validate coordinates
    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new ValidationError("Invalid latitude or longitude");
    }

    // Get nearby members
    const members = await this.locationRepo.getNearbyMembers(
      userId,
      festivalId,
      latitude,
      longitude,
      radiusMeters,
      groupId,
    );

    // Filter out user's own location (shouldn't be in results, but defensive)
    return members.filter((m) => m.userId !== userId);
  }

  /**
   * Expire old location sessions
   * Called by cron job to clean up expired sessions
   */
  async expireOldSessions(): Promise<void> {
    await this.locationRepo.expireOldSessions();
  }
}
