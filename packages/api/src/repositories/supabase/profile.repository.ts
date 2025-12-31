import type { Database } from "@prostcounter/db";
import type {
  Profile,
  ProfileShort,
  UpdateProfileInput,
  TutorialStatus,
  MissingProfileFields,
  Highlights,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export class SupabaseProfileRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) {
      throw new Error(`Profile not found: ${error?.message}`);
    }

    return data as Profile;
  }

  async getProfileShort(userId: string, email?: string): Promise<ProfileShort> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("full_name, username, avatar_url, custom_beer_cost")
      .eq("id", userId)
      .single();

    if (error || !data) {
      throw new Error(`Profile not found: ${error?.message}`);
    }

    return {
      ...data,
      email: email ?? null,
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<Profile> {
    const { data, error } = await this.supabase
      .from("profiles")
      .update({
        username: input.username,
        full_name: input.full_name,
        custom_beer_cost: input.custom_beer_cost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update profile: ${error?.message}`);
    }

    return data as Profile;
  }

  async deleteProfile(userId: string): Promise<void> {
    // Delete user's data in order (respecting foreign keys)
    // 1. Delete consumptions
    await this.supabase.from("consumptions").delete().eq("user_id", userId);

    // 2. Delete beer pictures
    await this.supabase.from("beer_pictures").delete().eq("user_id", userId);

    // 3. Delete tent visits
    await this.supabase.from("tent_visits").delete().eq("user_id", userId);

    // 4. Delete attendances
    await this.supabase.from("attendances").delete().eq("user_id", userId);

    // 5. Delete group memberships
    await this.supabase.from("group_members").delete().eq("user_id", userId);

    // 6. Delete reservations
    await this.supabase.from("reservations").delete().eq("user_id", userId);

    // 7. Delete user achievements
    await this.supabase
      .from("user_achievements")
      .delete()
      .eq("user_id", userId);

    // 8. Delete notification preferences
    await this.supabase
      .from("user_notification_preferences")
      .delete()
      .eq("user_id", userId);

    // 9. Delete location data (use type assertion as these tables may not be in generated types)
    await (this.supabase as any)
      .from("user_locations")
      .delete()
      .eq("user_id", userId);
    await (this.supabase as any)
      .from("location_sharing_preferences")
      .delete()
      .eq("user_id", userId);

    // 10. Delete profile (this should cascade or be handled by RLS)
    const { error } = await this.supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to delete profile: ${error.message}`);
    }
  }

  async getTutorialStatus(userId: string): Promise<TutorialStatus> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("tutorial_completed, tutorial_completed_at")
      .eq("id", userId)
      .single();

    if (error) {
      throw new Error(`Failed to get tutorial status: ${error.message}`);
    }

    return {
      tutorial_completed: data?.tutorial_completed ?? false,
      tutorial_completed_at: data?.tutorial_completed_at ?? null,
    };
  }

  async completeTutorial(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("profiles")
      .update({
        tutorial_completed: true,
        tutorial_completed_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to complete tutorial: ${error.message}`);
    }
  }

  async resetTutorial(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("profiles")
      .update({
        tutorial_completed: false,
        tutorial_completed_at: null,
      })
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to reset tutorial: ${error.message}`);
    }
  }

  async getMissingProfileFields(userId: string): Promise<{
    missingFields: MissingProfileFields;
    hasMissingFields: boolean;
  }> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("username, full_name, avatar_url")
      .eq("id", userId)
      .single();

    if (error || !data) {
      throw new Error(`Profile not found: ${error?.message}`);
    }

    const missingFields: MissingProfileFields = {
      username: !data.username,
      full_name: !data.full_name,
      avatar_url: !data.avatar_url,
    };

    return {
      missingFields,
      hasMissingFields: Object.values(missingFields).some(Boolean),
    };
  }

  async getHighlights(userId: string, festivalId: string): Promise<Highlights> {
    // Get user stats from the view
    const { data: stats, error: statsError } = await this.supabase.rpc(
      "get_user_festival_stats_with_positions",
      {
        p_user_id: userId,
        p_festival_id: festivalId,
      },
    );

    if (statsError) {
      throw new Error(`Failed to get highlights: ${statsError.message}`);
    }

    // Cast to any to handle varying RPC return types
    const userStats = (stats as any)?.[0];

    // Get favorite tent
    const { data: tentVisits } = await this.supabase
      .from("tent_visits")
      .select("tent_id, tents(name)")
      .eq("user_id", userId)
      .eq("festival_id", festivalId);

    const tentCounts = new Map<string, { count: number; name: string }>();
    (tentVisits ?? []).forEach((tv) => {
      const tentId = tv.tent_id;
      const tentName = (tv.tents as any)?.name || "Unknown";
      const current = tentCounts.get(tentId) || { count: 0, name: tentName };
      tentCounts.set(tentId, { count: current.count + 1, name: tentName });
    });

    let favoriteTent: string | null = null;
    let maxCount = 0;
    tentCounts.forEach((value) => {
      if (value.count > maxCount) {
        maxCount = value.count;
        favoriteTent = value.name;
      }
    });

    // Get group positions from top_positions field
    const groupPositions: Highlights["groupPositions"] = [];
    if (userStats?.top_positions) {
      const positions = userStats.top_positions as Array<{
        group_id: string;
        group_name: string;
        position: number;
        total_members: number;
      }>;
      positions.forEach((pos) => {
        groupPositions.push({
          groupId: pos.group_id,
          groupName: pos.group_name,
          position: pos.position,
          totalMembers: pos.total_members,
        });
      });
    }

    return {
      totalBeers: Number(userStats?.total_beers) || 0,
      totalDays: Number(userStats?.days_attended) || 0,
      totalSpent: Number(userStats?.total_spent_cents) || 0,
      avgBeersPerDay: Number(userStats?.avg_beers) || 0,
      favoriteDay: null, // Could be calculated if needed
      favoriteTent,
      groupPositions,
    };
  }

  async uploadAvatar(
    userId: string,
    fileName: string,
    fileBuffer: ArrayBuffer,
    contentType: string,
  ): Promise<string> {
    // Upload to storage
    const { error: uploadError } = await this.supabase.storage
      .from("avatars")
      .upload(fileName, fileBuffer, {
        contentType,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload avatar: ${uploadError.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = this.supabase.storage.from("avatars").getPublicUrl(fileName);

    // Update profile with new avatar URL
    const { error: updateError } = await this.supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    if (updateError) {
      throw new Error(`Failed to update avatar URL: ${updateError.message}`);
    }

    return publicUrl;
  }
}
