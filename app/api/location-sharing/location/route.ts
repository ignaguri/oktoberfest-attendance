import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { NextRequest } from "next/server";

const updateLocationSchema = z.object({
  festivalId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  altitude: z.number().optional(),
});

const getLocationsSchema = z.object({
  festivalId: z.string().uuid(),
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
    const { data: enabledGroups, error: groupsError } = await supabase
      .from("location_sharing_preferences")
      .select("group_id, groups:group_id(name)")
      .eq("user_id", user.id)
      .eq("festival_id", festivalId)
      .eq("sharing_enabled", true);

    if (groupsError) {
      reportSupabaseException("checkLocationSharingGroups", groupsError, {
        id: user.id,
      });
      return NextResponse.json(
        { error: "Failed to check sharing permissions" },
        { status: 500 },
      );
    }

    if (!enabledGroups || enabledGroups.length === 0) {
      return NextResponse.json(
        { error: "Location sharing not enabled for any groups" },
        { status: 403 },
      );
    }

    // First, expire any existing active locations
    await supabase
      .from("user_locations")
      .update({ status: "expired" })
      .eq("user_id", user.id)
      .eq("festival_id", festivalId)
      .eq("status", "active");

    // Insert new location
    const { data: location, error: locationError } = await supabase
      .from("user_locations")
      .insert({
        user_id: user.id,
        festival_id: festivalId,
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
        altitude,
        status: "active",
        expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
      })
      .select()
      .single();

    if (locationError) {
      reportSupabaseException("updateUserLocation", locationError, {
        id: user.id,
      });
      return NextResponse.json(
        { error: "Failed to update location" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      location,
      sharingWithGroups: enabledGroups
        .map((g) => g.groups?.name)
        .filter(Boolean),
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

    // Validate query parameters
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

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Call the database function to get nearby group members
    const { data: nearbyMembers, error } = await supabase.rpc(
      "get_nearby_group_members",
      {
        input_user_id: user.id,
        input_festival_id: festivalId,
        radius_meters: radiusMeters,
      },
    );

    if (error) {
      reportSupabaseException("getNearbyGroupMembers", error, { id: user.id });
      return NextResponse.json(
        { error: "Failed to fetch nearby members" },
        { status: 500 },
      );
    }

    return NextResponse.json({ nearbyMembers: nearbyMembers || [] });
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
    const { error } = await supabase
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
