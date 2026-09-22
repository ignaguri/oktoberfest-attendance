import type { Database } from "@prostcounter/db";
import type { GroupInvitation, InvitableUser, SentGroupInvitation } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";
import type { IGroupInvitationRepository, InvitationRpcResult } from "../interfaces";

/** Search results are capped the same way friend search is */
const SEARCH_LIMIT = 20;

type RpcPayload = {
  success: boolean;
  error_code?: string;
  invitation_id?: string;
  group_id?: string;
  inviter_id?: string;
  invitee_id?: string;
  festival_id?: string | null;
};

type IncomingRow = {
  id: string;
  group_id: string;
  group_name: string;
  festival_id: string;
  created_at: string;
  inviter_id: string;
  inviter_username: string | null;
  inviter_full_name: string | null;
  inviter_avatar_url: string | null;
};

type SentRow = {
  id: string;
  group_id: string;
  created_at: string;
  profiles: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  invitee_id: string;
};

function toResult(data: unknown): InvitationRpcResult {
  const payload = data as RpcPayload;
  return {
    success: payload.success,
    errorCode: payload.error_code,
    invitationId: payload.invitation_id,
    groupId: payload.group_id,
    inviterId: payload.inviter_id,
    inviteeId: payload.invitee_id,
    festivalId: payload.festival_id,
  };
}

export class SupabaseGroupInvitationRepository implements IGroupInvitationRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async invite(groupId: string, inviteeId: string): Promise<InvitationRpcResult> {
    const { data, error } = await this.supabase.rpc("invite_to_group", {
      p_group_id: groupId,
      p_invitee_id: inviteeId,
    });
    if (error) {
      throw new DatabaseError(`Failed to invite to group: ${error.message}`);
    }
    return toResult(data);
  }

  async accept(invitationId: string): Promise<InvitationRpcResult> {
    const { data, error } = await this.supabase.rpc("accept_group_invitation", {
      p_invitation_id: invitationId,
    });
    if (error) {
      throw new DatabaseError(`Failed to accept group invitation: ${error.message}`);
    }
    return toResult(data);
  }

  async decline(invitationId: string): Promise<InvitationRpcResult> {
    const { data, error } = await this.supabase.rpc("decline_group_invitation", {
      p_invitation_id: invitationId,
    });
    if (error) {
      throw new DatabaseError(`Failed to decline group invitation: ${error.message}`);
    }
    return toResult(data);
  }

  async cancel(invitationId: string): Promise<InvitationRpcResult> {
    const { data, error } = await this.supabase.rpc("cancel_group_invitation", {
      p_invitation_id: invitationId,
    });
    if (error) {
      throw new DatabaseError(`Failed to cancel group invitation: ${error.message}`);
    }
    return toResult(data);
  }

  async listIncoming(): Promise<GroupInvitation[]> {
    // A pending invitee is not a member, so the group's name comes from the
    // SECURITY DEFINER function rather than a join the RLS policy would have to
    // allow
    const { data, error } = await this.supabase.rpc("list_my_group_invitations");

    if (error) {
      throw new DatabaseError(`Failed to list group invitations: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as IncomingRow[];

    return rows.map((row) => ({
      id: row.id,
      groupId: row.group_id,
      groupName: row.group_name,
      festivalId: row.festival_id,
      createdAt: row.created_at,
      inviter: {
        id: row.inviter_id,
        username: row.inviter_username,
        fullName: row.inviter_full_name,
        avatarUrl: row.inviter_avatar_url,
      },
    }));
  }

  async listSent(groupId: string): Promise<SentGroupInvitation[]> {
    const { data, error } = await this.supabase
      .from("group_invitations")
      .select(
        `
        id,
        group_id,
        invitee_id,
        created_at,
        profiles!group_invitations_invitee_id_fkey(id, username, full_name, avatar_url)
      `,
      )
      .eq("group_id", groupId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      throw new DatabaseError(`Failed to list sent invitations: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as SentRow[];
    if (rows.length === 0) {
      return [];
    }

    // An invitee who already became a member (invite link, or an approved join
    // request) has nothing left to answer, mirroring list_my_group_invitations()'s
    // exclusion on the invitee's side. The invitation row itself stays "pending"
    // in that case, since nothing here marks it answered.
    const inviteeIds = rows.map((row) => row.invitee_id);
    const { data: members, error: membersError } = await this.supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId)
      .in("user_id", inviteeIds);

    if (membersError) {
      throw new DatabaseError(`Failed to list group members: ${membersError.message}`);
    }

    const memberIds = new Set((members ?? []).map((m) => m.user_id));

    return rows
      .filter((row) => !memberIds.has(row.invitee_id))
      .map((row) => ({
        id: row.id,
        groupId: row.group_id,
        createdAt: row.created_at,
        invitee: {
          id: row.profiles?.id ?? row.invitee_id,
          username: row.profiles?.username ?? null,
          fullName: row.profiles?.full_name ?? null,
          avatarUrl: row.profiles?.avatar_url ?? null,
        },
      }));
  }

  async listInvitableUsers(
    userId: string,
    groupId: string,
    query: string,
  ): Promise<InvitableUser[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .neq("id", userId)
      .or(`username.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`)
      .limit(SEARCH_LIMIT);

    if (error) throw new DatabaseError(error.message);
    if (!data || data.length === 0) return [];

    const userIds = data.map((profile) => profile.id);

    // Three batch lookups, joined in memory, so a 20-row search stays at four
    // queries rather than one per result
    const [members, invitations, joinRequests] = await Promise.all([
      this.supabase.from("group_members").select("user_id").eq("group_id", groupId).in("user_id", userIds),
      this.supabase
        .from("group_invitations")
        .select("id, invitee_id")
        .eq("group_id", groupId)
        .eq("status", "pending")
        .in("invitee_id", userIds),
      this.supabase
        .from("group_join_requests")
        .select("requester_id")
        .eq("group_id", groupId)
        .eq("status", "pending")
        .in("requester_id", userIds),
    ]);

    if (members.error) throw new DatabaseError(members.error.message);
    if (invitations.error) throw new DatabaseError(invitations.error.message);
    if (joinRequests.error) throw new DatabaseError(joinRequests.error.message);

    const memberIds = new Set((members.data ?? []).map((row) => row.user_id));
    const requesterIds = new Set((joinRequests.data ?? []).map((row) => row.requester_id));
    const invitationByInvitee = new Map(
      (invitations.data ?? []).map((row) => [row.invitee_id, row.id]),
    );

    return data.map((profile) => {
      // Membership wins over everything: there is nothing left to do for them
      if (memberIds.has(profile.id)) {
        return {
          id: profile.id,
          username: profile.username,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
          invitationStatus: "member" as const,
          invitationId: null,
        };
      }

      const invitationId = invitationByInvitee.get(profile.id);
      if (invitationId) {
        return {
          id: profile.id,
          username: profile.username,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
          invitationStatus: "invited" as const,
          invitationId,
        };
      }

      if (requesterIds.has(profile.id)) {
        return {
          id: profile.id,
          username: profile.username,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
          invitationStatus: "requested" as const,
          invitationId: null,
        };
      }

      return {
        id: profile.id,
        username: profile.username,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        invitationStatus: "none" as const,
        invitationId: null,
      };
    });
  }

  async isGroupCreator(groupId: string, userId: string): Promise<boolean> {
    // Filtered on both id and created_by, so a missing group and a group owned
    // by someone else both come back empty: the caller can't tell them apart.
    const { data, error } = await this.supabase
      .from("groups")
      .select("id")
      .eq("id", groupId)
      .eq("created_by", userId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to verify group creator: ${error.message}`);
    }

    return data !== null;
  }
}
