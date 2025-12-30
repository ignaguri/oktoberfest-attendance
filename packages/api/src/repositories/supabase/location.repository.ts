import type { ILocationRepository } from "../interfaces/location.repository";
import type { Database } from "@prostcounter/db";
import type {
  LocationSession,
  LocationPoint,
  LocationSessionMember,
  StartLocationSessionInput,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DatabaseError,
  NotFoundError,
  ConflictError,
} from "../../middleware/error";

export class SupabaseLocationRepository implements ILocationRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async startSession(
    userId: string,
    input: StartLocationSessionInput,
  ): Promise<LocationSession> {
    // Check if user already has an active session for this festival
    const existingSession = await this.getActiveSession(
      userId,
      input.festivalId,
    );
    if (existingSession) {
      throw new ConflictError(
        "User already has an active location session for this festival",
      );
    }

    const expiresAt = new Date(
      Date.now() + (input.durationMinutes || 120) * 60 * 1000,
    );

    const { data: session, error: sessionError } = await this.supabase
      .from("location_sessions")
      .insert({
        user_id: userId,
        festival_id: input.festivalId,
        is_active: true,
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (sessionError) {
      throw new DatabaseError(
        `Failed to create location session: ${sessionError.message}`,
      );
    }

    // If initial location provided, record it
    if (input.initialLocation) {
      await this.updateLocation(session.id, userId, input.initialLocation);
    }

    return this.mapToSession(session);
  }

  async stopSession(
    sessionId: string,
    userId: string,
  ): Promise<LocationSession> {
    const { data, error } = await this.supabase
      .from("location_sessions")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new NotFoundError("Location session not found");
      }
      throw new DatabaseError(
        `Failed to stop location session: ${error.message}`,
      );
    }

    return this.mapToSession(data);
  }

  async getActiveSession(
    userId: string,
    festivalId: string,
  ): Promise<LocationSession | null> {
    const { data, error } = await this.supabase
      .from("location_sessions")
      .select()
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error && error.code !== "PGRST116") {
      throw new DatabaseError(
        `Failed to fetch active session: ${error.message}`,
      );
    }

    if (!data) return null;

    return this.mapToSession(data);
  }

  async getActiveSessions(userId: string): Promise<LocationSession[]> {
    const { data, error } = await this.supabase
      .from("location_sessions")
      .select()
      .eq("user_id", userId)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString());

    if (error) {
      throw new DatabaseError(
        `Failed to fetch active sessions: ${error.message}`,
      );
    }

    return data.map((s) => this.mapToSession(s));
  }

  async updateLocation(
    sessionId: string,
    userId: string,
    location: LocationPoint,
  ): Promise<void> {
    // Verify session belongs to user and is active
    const { data: session, error: sessionError } = await this.supabase
      .from("location_sessions")
      .select()
      .eq("id", sessionId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (sessionError || !session) {
      throw new NotFoundError("Active location session not found");
    }

    // Insert new location point
    const { error: locationError } = await this.supabase
      .from("location_points")
      .insert({
        session_id: sessionId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || null,
        recorded_at: location.timestamp,
      });

    if (locationError) {
      throw new DatabaseError(
        `Failed to update location: ${locationError.message}`,
      );
    }

    // Update session's updated_at timestamp
    await this.supabase
      .from("location_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  async getNearbyMembers(
    userId: string,
    festivalId: string,
    latitude: number,
    longitude: number,
    radiusMeters: number,
    groupId?: string,
  ): Promise<LocationSessionMember[]> {
    // Use the database RPC function for proximity search
    const { data, error } = await this.supabase.rpc(
      "get_nearby_group_members",
      {
        input_user_id: userId,
        input_festival_id: festivalId,
        radius_meters: radiusMeters,
      },
    );

    if (error) {
      throw new DatabaseError(
        `Failed to fetch nearby members: ${error.message}`,
      );
    }

    // Filter by groupId if provided
    let filtered = data || [];
    if (groupId) {
      filtered = filtered.filter((m: any) => m.group_id === groupId);
    }

    return filtered.map((m: any) => ({
      sessionId: m.session_id,
      userId: m.user_id,
      username: m.username,
      fullName: m.full_name,
      avatarUrl: m.avatar_url,
      groupId: m.group_id,
      groupName: m.group_name,
      lastLocation:
        m.latitude && m.longitude
          ? {
              latitude: m.latitude,
              longitude: m.longitude,
              accuracy: m.accuracy,
              timestamp: m.last_updated,
            }
          : null,
      distance: m.distance_meters,
    }));
  }

  async expireOldSessions(): Promise<void> {
    const { error } = await this.supabase.rpc("expire_old_location_sessions");

    if (error) {
      throw new DatabaseError(
        `Failed to expire old sessions: ${error.message}`,
      );
    }
  }

  private mapToSession(data: any): LocationSession {
    return {
      id: data.id,
      userId: data.user_id,
      festivalId: data.festival_id,
      isActive: data.is_active,
      startedAt: data.started_at,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
