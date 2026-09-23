import type { Database } from "@prostcounter/db";
import type { GroupInvitation, InvitableUser, SentGroupInvitation } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";
import type { IGroupInvitationRepository, InvitationRpcResult } from "../interfaces";
import { stripSearchWildcards } from "./search-term";

/** Search results are capped the same way friend search is */
const SEARCH_LIMIT = 20;

/**
 * Days invite_to_group refuses a re-invite after a decline. Must match the
 * interval in 20260922193312_group_invitations.sql: the search list reports the
 * same status for a person inside this window as for one with a live
 * invitation, so the creator is never offered a button that is going to fail.
 */
const DECLINE_COOLDOWN_DAYS = 7;

type RpcPayload = {
  success: boolean;
  error_code?: string;
  invitation_id?: string;
  group_id?: string;
  inviter_id?: string;
  invitee_id?: string;
  festival_id?: string | null;
  notify_invitee?: boolean;
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
    notifyInvitee: payload.notify_invitee,
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
    // exclusion on the invitee's side. The group_members trigger resolves those
    // rows now, so this only still catches rows written before it existed.
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

    // Two `ilike` queries rather than one `.or()`: the term would otherwise be
    // interpolated into PostgREST's filter syntax, where a comma in a name
    // ("Muller, Anna") splits it into fragments and the whole search 400s.
    // Same reasoning as admin.repository.ts's user search.
    const pattern = `%${stripSearchWildcards(trimmed)}%`;
    const profileColumns = "id, username, full_name, avatar_url";

    const [byUsername, byFullName] = await Promise.all([
      this.supabase
        .from("profiles")
        .select(profileColumns)
        .neq("id", userId)
        .ilike("username", pattern)
        .limit(SEARCH_LIMIT),
      this.supabase
        .from("profiles")
        .select(profileColumns)
        .neq("id", userId)
        .ilike("full_name", pattern)
        .limit(SEARCH_LIMIT),
    ]);

    if (byUsername.error) throw new DatabaseError(byUsername.error.message);
    if (byFullName.error) throw new DatabaseError(byFullName.error.message);

    // Username matches first, so the cap keeps the more exact matches when both
    // queries come back full
    const byId = new Map<string, (typeof byUsername.data)[number]>();
    for (const profile of [...(byUsername.data ?? []), ...(byFullName.data ?? [])]) {
      if (!byId.has(profile.id)) {
        byId.set(profile.id, profile);
      }
    }

    const data = [...byId.values()].slice(0, SEARCH_LIMIT);
    if (data.length === 0) return [];

    const userIds = data.map((profile) => profile.id);

    // Three batch lookups, joined in memory, so a 20-row search stays at four
    // queries rather than one per result
    const [members, invitations, joinRequests] = await Promise.all([
      this.supabase.from("group_members").select("user_id").eq("group_id", groupId).in("user_id", userIds),
      this.supabase
        .from("group_invitations")
        .select("id, invitee_id, status, responded_at")
        .eq("group_id", groupId)
        .in("status", ["pending", "declined"])
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

    // A decline inside the cooldown blocks a re-invite just as a live
    // invitation does, and invite_to_group deliberately reports the same code
    // for both so the creator is not told they were turned down. The list has
    // to agree, or the creator gets an Invite button that always fails: these
    // rows report "invited" with no invitation id, which is what the UIs read
    // to show the status without offering a withdraw action.
    const cooldownStart = Date.now() - DECLINE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    const invitationByInvitee = new Map<string, string | null>();
    for (const row of invitations.data ?? []) {
      if (row.status === "pending") {
        invitationByInvitee.set(row.invitee_id, row.id);
        continue;
      }
      const respondedAt = row.responded_at ? Date.parse(row.responded_at) : NaN;
      if (Number.isFinite(respondedAt) && respondedAt > cooldownStart) {
        // A live invitation always wins: it is the row that can be withdrawn
        if (!invitationByInvitee.has(row.invitee_id)) {
          invitationByInvitee.set(row.invitee_id, null);
        }
      }
    }

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

      if (invitationByInvitee.has(profile.id)) {
        return {
          id: profile.id,
          username: profile.username,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
          invitationStatus: "invited" as const,
          invitationId: invitationByInvitee.get(profile.id) ?? null,
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
