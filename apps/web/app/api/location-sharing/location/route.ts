import type { PostgrestError } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

// NOTE: This API uses deprecated tables (user_locations, location_sharing_preferences)
// that were replaced by location_sessions, location_session_members, location_points.
// This needs to be refactored to use the new schema.

const updateLocationSchema = z.object({
  festivalId: z.uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  altitude: z.number().optional(),
});

const getLocationsSchema = z.object({
  festivalId: z.uuid(),
  radiusMeters: z.number().min(1).max(10000).optional().default(500),
});

// POST /api/location-sharing/location - Update user's location
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Parse and validate request body
    const body = await request.json();
    const result = updateLocationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.issues },
        { status: 400 },
      );
    }

    const {
      festivalId,
      latitude,
      longitude,
      accuracy,
      heading,
      speed,
      altitude,
    } = result.data;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has any groups with location sharing enabled for this festival
    // Using type assertion as these tables are deprecated (see note at top of file)
    const {
      data: preferences,
      error: groupsError,
      count,
    } = await (supabase as any)
      .from("location_sharing_preferences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("festival_id", festivalId)
      .eq("sharing_enabled", true);

    console.log("Location sharing check:", {
      userId: user.id,
      festivalId,
      count,
      preferencesCount: preferences?.length || 0,
      error: groupsError,
    });

    if (groupsError) {
      reportSupabaseException("checkLocationSharingGroups", groupsError, {
        id: user.id,
      });
      return NextResponse.json(
        { error: "Failed to check sharing permissions" },
        { status: 500 },
      );
    }

    if (!count || count === 0) {
      return NextResponse.json(
        { error: "Location sharing not enabled for any groups" },
        { status: 403 },
      );
    }

    // Using any type as these tables are deprecated (see note at top of file)
    const locationData = {
      user_id: user.id,
      festival_id: festivalId,
      latitude,
      longitude,
      status: "active",
      accuracy,
      heading,
      speed,
      altitude,
      last_updated: new Date().toISOString(),
      expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
    };

    console.log("Upserting location:", locationData);

    const { data: location, error: locationError } = await (supabase as any)
      .from("user_locations")
      .upsert(locationData, { onConflict: "user_id,festival_id" })
      .select()
      .single();

    if (locationError) {
      console.error("Failed to insert location:", locationError);
      reportSupabaseException("updateUserLocation", locationError, {
        id: user.id,
      });
      return NextResponse.json(
        { error: "Failed to update location" },
        { status: 500 },
      );
    }

    console.log("Location upserted successfully:", location.id);

    return NextResponse.json({
      location,
      sharingEnabled: true,
    });
  } catch (error) {
    console.error("Error in POST /api/location-sharing/location:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// GET /api/location-sharing/location - Get nearby group members
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const result = getLocationsSchema.safeParse({
      festivalId: searchParams.get("festivalId"),
      radiusMeters: searchParams.get("radiusMeters")
        ? parseInt(searchParams.get("radiusMeters")!)
        : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: result.error.issues },
        { status: 400 },
      );
    }

    const { festivalId, radiusMeters } = result.data;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: locationRows, error: locationError } = await (supabase as any)
      .from("user_locations")
      .select("id, last_updated, expires_at")
      .eq("user_id", user.id)
      .eq("festival_id", festivalId)
      .eq("status", "active")
      .limit(1);

    if (locationError) {
      reportSupabaseException("getCurrentLocation", locationError, {
        id: user.id,
      });
      return NextResponse.json(
        { error: "Failed to fetch current location" },
        { status: 500 },
      );
    }

    const hasActiveLocation = (locationRows?.length ?? 0) > 0;

    let nearbyMembers: unknown[] = [];
    let nearbyError: Error | null = null;

    if (hasActiveLocation) {
      const { data, error } = await supabase.rpc("get_nearby_group_members", {
        input_user_id: user.id,
        input_festival_id: festivalId,
        radius_meters: radiusMeters,
      });

      nearbyMembers = data || [];
      nearbyError = error;
    }

    if (nearbyError) {
      reportSupabaseException(
        "getNearbyGroupMembers",
        nearbyError as PostgrestError,
        {
          id: user.id,
        },
      );
      return NextResponse.json(
        { error: "Failed to fetch nearby members" },
        { status: 500 },
      );
    }

    const currentLocation = locationRows?.[0] ?? null;

    return NextResponse.json({
      activeSharing: hasActiveLocation,
      currentLocation,
      nearbyMembers,
    });
  } catch (error) {
    console.error("Error in GET /api/location-sharing/location:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/location-sharing/location - Stop sharing location
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const festivalId = searchParams.get("festivalId");
    if (!festivalId) {
      return NextResponse.json(
        { error: "festivalId parameter is required" },
        { status: 400 },
      );
    }

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Set all active locations to expired
    const { error } = await (supabase as any)
      .from("user_locations")
      .update({ status: "expired" })
      .eq("user_id", user.id)
      .eq("festival_id", festivalId)
      .eq("status", "active");

    if (error) {
      reportSupabaseException("stopLocationSharing", error, { id: user.id });
      return NextResponse.json(
        { error: "Failed to stop location sharing" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/location-sharing/location:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
