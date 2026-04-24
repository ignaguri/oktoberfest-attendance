import type { Database } from "@prostcounter/db";
import type {
  Friend,
  FriendRequest,
  FriendshipStatusCheck,
  FriendSuggestion,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";
import type { IFriendRepository } from "../interfaces";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export class SupabaseFriendRepository implements IFriendRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async listFriends(userId: string): Promise<Friend[]> {
    // Get accepted friendships where user is either requester or addressee
    const { data, error } = await this.supabase
      .from("friendships")
      .select(
        `
        id,
        requester_id,
        addressee_id,
        updated_at,
        requester:profiles!friendships_requester_id_fkey(id, username, full_name, avatar_url),
        addressee:profiles!friendships_addressee_id_fkey(id, username, full_name, avatar_url)
      `,
      )
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (error) throw new DatabaseError(error.message);

    return (data || []).map((row) => {
      const isRequester = row.requester_id === userId;
      const friendProfile = isRequester
        ? (row.addressee as unknown as ProfileRow)
        : (row.requester as unknown as ProfileRow);

      return {
        id: friendProfile.id,
        username: friendProfile.username,
        fullName: friendProfile.full_name,
        avatarUrl: friendProfile.avatar_url,
        friendshipId: row.id,
        friendsSince: row.updated_at,
      };
    });
  }

  async getIncomingRequests(userId: string): Promise<FriendRequest[]> {
    const { data, error } = await this.supabase
      .from("friendships")
      .select(
        `
        id,
        requester_id,
        addressee_id,
        status,
        created_at,
        updated_at,
        requester:profiles!friendships_requester_id_fkey(id, username, full_name, avatar_url)
      `,
      )
      .eq("addressee_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw new DatabaseError(error.message);

    return (data || []).map((row) => {
      const profile = row.requester as unknown as ProfileRow;
      return {
        id: row.id,
        requesterId: row.requester_id,
        addresseeId: row.addressee_id,
        status: row.status as "pending",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        profile: {
          id: profile.id,
          username: profile.username,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
        },
      };
    });
  }

  async getOutgoingRequests(userId: string): Promise<FriendRequest[]> {
    const { data, error } = await this.supabase
      .from("friendships")
      .select(
        `
        id,
        requester_id,
        addressee_id,
        status,
        created_at,
        updated_at,
        addressee:profiles!friendships_addressee_id_fkey(id, username, full_name, avatar_url)
      `,
      )
      .eq("requester_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw new DatabaseError(error.message);

    return (data || []).map((row) => {
      const profile = row.addressee as unknown as ProfileRow;
      return {
        id: row.id,
        requesterId: row.requester_id,
        addresseeId: row.addressee_id,
        status: row.status as "pending",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        profile: {
          id: profile.id,
          username: profile.username,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
        },
      };
    });
  }

  async getIncomingRequestCount(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("addressee_id", userId)
      .eq("status", "pending");

    if (error) throw new DatabaseError(error.message);
    return count || 0;
  }

  async sendRequest(
    requesterId: string,
    addresseeId: string,
  ): Promise<{
    success: boolean;
    friendshipId?: string;
    status?: string;
    errorCode?: string;
    message?: string;
  }> {
    const { data, error } = await this.supabase.rpc("send_friend_request", {
      p_requester_id: requesterId,
      p_addressee_id: addresseeId,
    });

    if (error) throw new DatabaseError(error.message);

    const result = data as unknown as {
      success: boolean;
      friendship_id?: string;
      status?: string;
      error_code?: string;
      message?: string;
    };

    return {
      success: result.success,
      friendshipId: result.friendship_id,
      status: result.status,
      errorCode: result.error_code,
      message: result.message,
    };
  }

  async acceptRequest(
    friendshipId: string,
    userId: string,
  ): Promise<{ success: boolean; errorCode?: string; message?: string }> {
    const { data, error } = await this.supabase.rpc("accept_friend_request", {
      p_friendship_id: friendshipId,
      p_user_id: userId,
    });

    if (error) throw new DatabaseError(error.message);

    const result = data as unknown as {
      success: boolean;
      error_code?: string;
      message?: string;
    };

    return {
      success: result.success,
      errorCode: result.error_code,
      message: result.message,
    };
  }

  async declineRequest(
    friendshipId: string,
    userId: string,
  ): Promise<{ success: boolean; errorCode?: string; message?: string }> {
    const { data, error } = await this.supabase.rpc("decline_friend_request", {
      p_friendship_id: friendshipId,
      p_user_id: userId,
    });

    if (error) throw new DatabaseError(error.message);

    const result = data as unknown as {
      success: boolean;
      error_code?: string;
      message?: string;
    };

    return {
      success: result.success,
      errorCode: result.error_code,
      message: result.message,
    };
  }

  async cancelRequest(friendshipId: string, userId: string): Promise<void> {
    const { data: deleted, error } = await this.supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId)
      .eq("requester_id", userId)
      .eq("status", "pending")
      .select("id");

    if (error) throw new DatabaseError(error.message);

    if (!deleted || deleted.length === 0) {
      throw new DatabaseError(
        `Friend request cancel affected 0 rows for id=${friendshipId}; not pending, not the requester, or RLS policy blocked`,
      );
    }
  }

  async unfriend(userId: string, friendUserId: string): Promise<void> {
    const { data: deleted, error } = await this.supabase
      .from("friendships")
      .delete()
      .eq("status", "accepted")
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${friendUserId}),and(requester_id.eq.${friendUserId},addressee_id.eq.${userId})`,
      )
      .select("id");

    if (error) throw new DatabaseError(error.message);

    if (!deleted || deleted.length === 0) {
      throw new DatabaseError(
        `Unfriend affected 0 rows for pair (${userId}, ${friendUserId}); no accepted friendship or RLS policy blocked`,
      );
    }
  }

  async getSuggestions(userId: string): Promise<FriendSuggestion[]> {
    // People who share a group but are NOT already friends or pending
    const { data: groupMembers, error: gmError } = await this.supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);

    if (gmError) throw new DatabaseError(gmError.message);
    if (!groupMembers || groupMembers.length === 0) return [];

    const groupIds = groupMembers.map((gm) => gm.group_id);

    // Get all members of those groups (excluding self)
    const { data: sharedMembers, error: smError } = await this.supabase
      .from("group_members")
      .select(
        `
        user_id,
        group_id,
        profile:profiles!fk_user_id(id, username, full_name, avatar_url)
      `,
      )
      .in("group_id", groupIds)
      .neq("user_id", userId);

    if (smError) throw new DatabaseError(smError.message);

    // Get existing friendships to exclude
    const { data: existingFriendships, error: efError } = await this.supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (efError) throw new DatabaseError(efError.message);

    const connectedUserIds = new Set<string>();
    for (const f of existingFriendships || []) {
      connectedUserIds.add(
        f.requester_id === userId ? f.addressee_id : f.requester_id,
      );
    }

    // Aggregate shared groups per user, excluding existing connections
    const userMap = new Map<
      string,
      { profile: ProfileRow; sharedGroups: number }
    >();

    for (const member of sharedMembers || []) {
      const memberId = member.user_id as string;
      if (connectedUserIds.has(memberId)) continue;
      const profile = member.profile as unknown as ProfileRow;
      const existing = userMap.get(memberId);
      if (existing) {
        existing.sharedGroups += 1;
      } else {
        userMap.set(memberId, { profile, sharedGroups: 1 });
      }
    }

    return Array.from(userMap.values())
      .sort((a, b) => b.sharedGroups - a.sharedGroups)
      .slice(0, 20)
      .map(({ profile, sharedGroups }) => ({
        id: profile.id,
        username: profile.username,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        sharedGroups,
      }));
  }

  async searchUsers(
    userId: string,
    query: string,
  ): Promise<
    {
      id: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      friendshipStatus:
        | "friends"
        | "pending_sent"
        | "pending_received"
        | "none";
    }[]
  > {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .neq("id", userId)
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(20);

    if (error) throw new DatabaseError(error.message);

    if (!data || data.length === 0) return [];

    // Batch-fetch friendship statuses for all results
    const userIds = data.map((p) => p.id);
    const { data: friendships, error: fError } = await this.supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(
        `and(requester_id.eq.${userId},addressee_id.in.(${userIds.join(",")})),and(addressee_id.eq.${userId},requester_id.in.(${userIds.join(",")}))`,
      );

    if (fError) throw new DatabaseError(fError.message);

    const friendshipMap = new Map<
      string,
      "friends" | "pending_sent" | "pending_received" | "none"
    >();
    for (const f of friendships || []) {
      const otherUserId =
        f.requester_id === userId ? f.addressee_id : f.requester_id;
      if (f.status === "accepted") {
        friendshipMap.set(otherUserId, "friends");
      } else if (f.status === "pending") {
        friendshipMap.set(
          otherUserId,
          f.requester_id === userId ? "pending_sent" : "pending_received",
        );
      }
    }

    return data.map((p) => ({
      id: p.id,
      username: p.username,
      fullName: p.full_name,
      avatarUrl: p.avatar_url,
      friendshipStatus: friendshipMap.get(p.id) ?? "none",
    }));
  }

  async getFriendshipStatus(
    userId: string,
    otherUserId: string,
  ): Promise<FriendshipStatusCheck> {
    const { data, error } = await this.supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(
        `and(requester_id.eq.${userId},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${userId})`,
      )
      .limit(1)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);

    if (!data) {
      return { status: "none", friendshipId: null };
    }

    if (data.status === "accepted") {
      return { status: "friends", friendshipId: data.id };
    }

    if (data.status === "pending") {
      if (data.requester_id === userId) {
        return { status: "pending_sent", friendshipId: data.id };
      }
      return { status: "pending_received", friendshipId: data.id };
    }

    return { status: "none", friendshipId: null };
  }
}
