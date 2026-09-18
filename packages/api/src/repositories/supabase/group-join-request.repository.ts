import type { Database } from "@prostcounter/db";
import type { GroupJoinRequest } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";
import type { IGroupJoinRequestRepository, JoinRequestRpcResult } from "../interfaces";

/** Mirrors `interval '7 days'` in request_to_join_group */
export const JOIN_REQUEST_DECLINE_COOLDOWN_DAYS = 7;

type RpcPayload = {
  success: boolean;
  error_code?: string;
  request_id?: string;
  group_id?: string;
  requester_id?: string;
  festival_id?: string | null;
};

type IncomingRow = {
  id: string;
  group_id: string;
  requester_id: string;
  created_at: string;
  groups: { name: string; created_by: string | null } | null;
  profiles: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

function toResult(data: unknown): JoinRequestRpcResult {
  const payload = data as RpcPayload;
  return {
    success: payload.success,
    errorCode: payload.error_code,
    requestId: payload.request_id,
    groupId: payload.group_id,
    requesterId: payload.requester_id,
    festivalId: payload.festival_id,
  };
}

export class SupabaseGroupJoinRequestRepository implements IGroupJoinRequestRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async request(groupId: string): Promise<JoinRequestRpcResult> {
    const { data, error } = await this.supabase.rpc("request_to_join_group", {
      p_group_id: groupId,
    });
    if (error) {
      throw new DatabaseError(`Failed to request to join group: ${error.message}`);
    }
    return toResult(data);
  }

  async accept(requestId: string): Promise<JoinRequestRpcResult> {
    const { data, error } = await this.supabase.rpc("accept_join_request", {
      p_request_id: requestId,
    });
    if (error) {
      throw new DatabaseError(`Failed to accept join request: ${error.message}`);
    }
    return toResult(data);
  }

  async decline(requestId: string): Promise<JoinRequestRpcResult> {
    const { data, error } = await this.supabase.rpc("decline_join_request", {
      p_request_id: requestId,
    });
    if (error) {
      throw new DatabaseError(`Failed to decline join request: ${error.message}`);
    }
    return toResult(data);
  }

  async cancel(groupId: string): Promise<void> {
    const { error } = await this.supabase.rpc("cancel_join_request", { p_group_id: groupId });
    if (error) {
      throw new DatabaseError(`Failed to cancel join request: ${error.message}`);
    }
  }

  async listIncoming(creatorId: string): Promise<GroupJoinRequest[]> {
    const { data, error } = await this.supabase
      .from("group_join_requests")
      .select(
        `
        id,
        group_id,
        requester_id,
        created_at,
        groups!inner(name, created_by),
        profiles!group_join_requests_requester_id_fkey(id, username, full_name, avatar_url)
      `,
      )
      .eq("status", "pending")
      .eq("groups.created_by", creatorId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new DatabaseError(`Failed to list join requests: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as IncomingRow[];
    if (rows.length === 0) {
      return [];
    }

    // Someone who joined through an invite link meanwhile has nothing left to approve
    const groupIds = [...new Set(rows.map((row) => row.group_id))];
    const { data: members, error: membersError } = await this.supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds);

    if (membersError) {
      throw new DatabaseError(`Failed to list group members: ${membersError.message}`);
    }

    const memberKeys = new Set((members ?? []).map((m) => `${m.group_id}:${m.user_id}`));

    return rows
      .filter((row) => !memberKeys.has(`${row.group_id}:${row.requester_id}`))
      .map((row) => ({
        id: row.id,
        groupId: row.group_id,
        groupName: row.groups?.name ?? "",
        createdAt: row.created_at,
        requester: {
          id: row.profiles?.id ?? row.requester_id,
          username: row.profiles?.username ?? null,
          fullName: row.profiles?.full_name ?? null,
          avatarUrl: row.profiles?.avatar_url ?? null,
        },
      }));
  }

  async listBlockingGroupIds(requesterId: string, groupIds: string[]): Promise<string[]> {
    if (groupIds.length === 0) {
      return [];
    }

    const cooldownStart = new Date(
      Date.now() - JOIN_REQUEST_DECLINE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await this.supabase
      .from("group_join_requests")
      .select("group_id")
      .eq("requester_id", requesterId)
      .in("group_id", groupIds)
      .or(`status.eq.pending,and(status.eq.declined,responded_at.gt.${cooldownStart})`);

    if (error) {
      throw new DatabaseError(`Failed to read join request state: ${error.message}`);
    }

    return [...new Set((data ?? []).map((row) => row.group_id))];
  }
}
