import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createNotificationService } from "@/lib/services/notifications";
import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";

// NOTE: This API uses deprecated tables (location_sharing_preferences)
// that were replaced by location_sessions, location_session_members.
// This needs to be refactored to use the new schema.

const updatePreferencesSchema = z.object({
  groupId: z.uuid(),
  festivalId: z.uuid(),
  sharingEnabled: z.boolean(),
  autoEnableOnCheckin: z.boolean().optional().default(false),
  notificationEnabled: z.boolean().optional().default(true),
});

const getPreferencesSchema = z.object({
  festivalId: z.uuid(),
});

// GET /api/location-sharing/preferences - Get user's location sharing preferences
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const result = getPreferencesSchema.safeParse({
      festivalId: searchParams.get("festivalId"),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: result.error.issues },
        { status: 400 },
      );
    }

    const { festivalId } = result.data;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's location sharing preferences for all groups in the festival
    // Using type assertion as these tables are deprecated (see note at top of file)
    const { data: preferences, error } = await (supabase as any)
      .from("location_sharing_preferences")
      .select(
        `
        *,
        groups:group_id (
          id,
          name
        )
      `,
      )
      .eq("user_id", user.id)
      .eq("festival_id", festivalId);

    if (error) {
      reportSupabaseException("getLocationSharingPreferences", error, {
        id: user.id,
      });
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 },
      );
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("Error in GET /api/location-sharing/preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/location-sharing/preferences - Update location sharing preferences
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Parse and validate request body
    const body = await request.json();
    const result = updatePreferencesSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.issues },
        { status: 400 },
      );
    }

    const {
      groupId,
      festivalId,
      sharingEnabled,
      autoEnableOnCheckin,
      notificationEnabled,
    } = result.data;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a member of the group
    const { data: membership, error: membershipError } = await supabase
      .from("group_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("group_id", groupId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Not a member of this group" },
        { status: 403 },
      );
    }

    // Upsert location sharing preferences
    // Using type assertion as these tables are deprecated (see note at top of file)
    const { data: preferences, error } = await (supabase as any)
      .from("location_sharing_preferences")
      .upsert(
        {
          user_id: user.id,
          group_id: groupId,
          festival_id: festivalId,
          sharing_enabled: sharingEnabled,
          auto_enable_on_checkin: autoEnableOnCheckin,
          notification_enabled: notificationEnabled,
        },
        {
          onConflict: "user_id,group_id,festival_id",
        },
      )
      .select()
      .single();

    if (error) {
      reportSupabaseException("updateLocationSharingPreferences", error, {
        id: user.id,
      });
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 },
      );
    }

    // Send notification if sharing was enabled
    if (sharingEnabled) {
      try {
        const notificationService = createNotificationService();
        await notificationService.notifyLocationSharing(
          user.id,
          groupId,
          "started",
        );
      } catch (error) {
        console.warn("Failed to send location sharing notification:", error);
        // Don't fail the request if notification fails
      }
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("Error in POST /api/location-sharing/preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
