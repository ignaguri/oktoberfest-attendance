import type { Database, Tables, TablesUpdate } from "@prostcounter/db";
import type {
  DayPlan,
  DayPlanCompanions,
  DayPlanKind,
  FriendsGoingDay,
  GetCompanionOptionsResponse,
  ReservationStatus,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { groupFriendsGoing } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PgErrorCode } from "../../lib/postgres-errors";
import {
  ConflictError,
  DatabaseError,
  NotFoundError,
  ValidationError,
} from "../../middleware/error";
import type { DayPlanWrite, FestivalDayContext, IDayPlanRepository } from "../interfaces";

/** PostgREST filter for rows that still count as the day's mark. */
export const ACTIVE_DAY_PLAN_FILTER = "status.is.null,status.neq.cancelled";

const COMPANIONS_SELECT =
  "day_plan_companions(user_id, group_id, profiles(username, full_name, avatar_url), groups(name))";

const DAY_PLAN_SELECT = `*, tents(name), ${COMPANIONS_SELECT}`;

interface CompanionRow {
  user_id: string | null;
  group_id: string | null;
  profiles: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
  groups: { name: string } | null;
}

type DayPlanRowWithTent = Tables<"day_plans"> & {
  tents: { name: string } | null;
  day_plan_companions: CompanionRow[] | null;
};

function byName(a: string | null, b: string | null): number {
  return (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" });
}

/** A group the reader can't see comes back without a name and is left out. */
export function mapCompanions(rows: CompanionRow[] | null): DayPlanCompanions {
  const users: DayPlanCompanions["users"] = [];
  const groups: DayPlanCompanions["groups"] = [];

  for (const row of rows ?? []) {
    if (row.user_id) {
      users.push({
        userId: row.user_id,
        username: row.profiles?.username ?? null,
        fullName: row.profiles?.full_name ?? null,
        avatarUrl: row.profiles?.avatar_url ?? null,
      });
    } else if (row.group_id && row.groups) {
      groups.push({ groupId: row.group_id, name: row.groups.name });
    }
  }

  users.sort((a, b) => byName(a.username ?? a.fullName, b.username ?? b.fullName));
  groups.sort((a, b) => byName(a.name, b.name));

  return { users, groups };
}

export function mapDayPlan(row: DayPlanRowWithTent): DayPlan {
  return {
    id: row.id,
    userId: row.user_id,
    festivalId: row.festival_id,
    date: row.date,
    kind: row.kind as DayPlanKind,
    tentId: row.tent_id,
    tentName: row.tents?.name ?? null,
    note: row.note,
    visibleToGroups: row.visible_to_groups,
    companions: mapCompanions(row.day_plan_companions),
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status as ReservationStatus | null,
    reminderOffsetMinutes: row.reminder_offset_minutes,
    autoCheckin: row.auto_checkin,
    reminderSentAt: row.reminder_sent_at,
    promptSentAt: row.prompt_sent_at,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(write: DayPlanWrite): TablesUpdate<"day_plans"> {
  const row: TablesUpdate<"day_plans"> = {
    kind: write.kind,
    tent_id: write.tentId,
    note: write.note,
    visible_to_groups: write.visibleToGroups,
    start_at: write.startAt,
    end_at: write.endAt,
    status: write.status,
    reminder_offset_minutes: write.reminderOffsetMinutes,
    auto_checkin: write.autoCheckin,
  };

  // A plan may carry none of a reservation's bookkeeping, and the table's
  // check constraint rejects the downgrade if any of it is left behind.
  if (write.kind === "plan") {
    row.reminder_sent_at = null;
    row.prompt_sent_at = null;
    row.processed_at = null;
  }

  return row;
}

export class SupabaseDayPlanRepository implements IDayPlanRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getFestivalContext(festivalId: string): Promise<FestivalDayContext | null> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select("id, timezone, start_date, end_date")
      .eq("id", festivalId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to fetch festival: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    return {
      id: data.id,
      timezone: data.timezone,
      startDate: data.start_date,
      endDate: data.end_date,
    };
  }

  async listActive(userId: string, festivalId: string): Promise<DayPlan[]> {
    const { data, error } = await this.supabase
      .from("day_plans")
      .select(DAY_PLAN_SELECT)
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .or(ACTIVE_DAY_PLAN_FILTER)
      .order("date", { ascending: true });

    if (error) {
      throw new DatabaseError(`Failed to list day plans: ${error.message}`);
    }

    return data.map((row) => mapDayPlan(row as DayPlanRowWithTent));
  }

  async findActiveByDate(
    userId: string,
    festivalId: string,
    date: string,
  ): Promise<DayPlan | null> {
    const { data, error } = await this.supabase
      .from("day_plans")
      .select(DAY_PLAN_SELECT)
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .eq("date", date)
      .or(ACTIVE_DAY_PLAN_FILTER)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to fetch day plan: ${error.message}`);
    }

    return data ? mapDayPlan(data as DayPlanRowWithTent) : null;
  }

  async insert(
    userId: string,
    festivalId: string,
    date: string,
    write: DayPlanWrite,
  ): Promise<DayPlan> {
    const { data, error } = await this.supabase
      .from("day_plans")
      .insert({ ...toRow(write), kind: write.kind, user_id: userId, festival_id: festivalId, date })
      .select(DAY_PLAN_SELECT)
      .single();

    if (error?.code === PgErrorCode.UNIQUE_VIOLATION) {
      throw new ConflictError(ErrorCodes.DAY_PLAN_CONFLICT);
    }
    if (error || !data) {
      throw new DatabaseError(`Failed to create day plan: ${error?.message ?? "No data returned"}`);
    }

    return mapDayPlan(data as DayPlanRowWithTent);
  }

  async update(id: string, userId: string, write: DayPlanWrite): Promise<DayPlan> {
    const { data, error } = await this.supabase
      .from("day_plans")
      .update(toRow(write))
      .eq("id", id)
      .eq("user_id", userId)
      .select(DAY_PLAN_SELECT)
      .single();

    if (error?.code === PgErrorCode.NO_ROWS) {
      throw new NotFoundError(ErrorCodes.DAY_PLAN_NOT_FOUND);
    }
    if (error?.code === PgErrorCode.UNIQUE_VIOLATION) {
      throw new ConflictError(ErrorCodes.DAY_PLAN_CONFLICT);
    }
    if (error || !data) {
      throw new DatabaseError(`Failed to update day plan: ${error?.message ?? "No data returned"}`);
    }

    return mapDayPlan(data as DayPlanRowWithTent);
  }

  async deleteById(id: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from("day_plans")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new DatabaseError(`Failed to delete day plan: ${error.message}`);
    }
  }

  async cancel(id: string, userId: string): Promise<DayPlan> {
    const { data, error } = await this.supabase
      .from("day_plans")
      .update({ status: "cancelled", processed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select(DAY_PLAN_SELECT)
      .single();

    if (error?.code === PgErrorCode.NO_ROWS) {
      throw new NotFoundError(ErrorCodes.DAY_PLAN_NOT_FOUND);
    }
    if (error || !data) {
      throw new DatabaseError(`Failed to cancel day plan: ${error?.message ?? "No data returned"}`);
    }

    return mapDayPlan(data as DayPlanRowWithTent);
  }

  async setCompanions(planId: string, userIds: string[], groupIds: string[]): Promise<void> {
    const { error } = await this.supabase.rpc("set_day_plan_companions", {
      p_plan_id: planId,
      p_user_ids: userIds,
      p_group_ids: groupIds,
    });

    // RLS refuses a tag that isn't a friend, a group-mate or one of the user's groups
    if (error?.code === PgErrorCode.INSUFFICIENT_PRIVILEGE) {
      throw new ValidationError(ErrorCodes.DAY_PLAN_INVALID_COMPANION);
    }
    if (error) {
      throw new DatabaseError(`Failed to save plan companions: ${error.message}`);
    }
  }

  async listCompanionOptions(
    userId: string,
    festivalId: string,
  ): Promise<GetCompanionOptionsResponse> {
    const [friendshipsResult, sharedGroupMembersResult, groupsResult] = await Promise.all([
      this.supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
      this.supabase
        .from("v_user_shared_group_members")
        .select("owner_id")
        .eq("viewer_id", userId)
        .eq("festival_id", festivalId),
      this.supabase
        .from("group_members")
        .select("groups!inner(id, name, festival_id)")
        .eq("user_id", userId)
        .eq("groups.festival_id", festivalId),
    ]);

    if (friendshipsResult.error) {
      throw new DatabaseError(`Failed to list friendships: ${friendshipsResult.error.message}`);
    }
    if (sharedGroupMembersResult.error) {
      throw new DatabaseError(
        `Failed to list shared group members: ${sharedGroupMembersResult.error.message}`,
      );
    }
    if (groupsResult.error) {
      throw new DatabaseError(`Failed to list groups: ${groupsResult.error.message}`);
    }

    const userIds = new Set([
      ...friendshipsResult.data.map((row) =>
        row.requester_id === userId ? row.addressee_id : row.requester_id,
      ),
      ...sharedGroupMembersResult.data.flatMap((row) => (row.owner_id ? [row.owner_id] : [])),
    ]);
    userIds.delete(userId);

    let users: GetCompanionOptionsResponse["users"] = [];

    if (userIds.size > 0) {
      const { data: profiles, error: profilesError } = await this.supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", [...userIds]);

      if (profilesError) {
        throw new DatabaseError(`Failed to fetch profiles: ${profilesError.message}`);
      }

      users = profiles
        .map((row) => ({
          userId: row.id,
          username: row.username,
          fullName: row.full_name,
          avatarUrl: row.avatar_url,
        }))
        .sort((a, b) => byName(a.username ?? a.fullName, b.username ?? b.fullName));
    }

    const groups = groupsResult.data
      .map((row) => ({ groupId: row.groups.id, name: row.groups.name }))
      .sort((a, b) => byName(a.name, b.name));

    return { users, groups };
  }

  async listFriendsGoing(
    userId: string,
    festivalId: string,
    fromDate: string,
  ): Promise<FriendsGoingDay[]> {
    const { data, error } = await this.supabase
      .from("day_plans")
      .select(
        `user_id, date, kind, start_at, note, tents(name), profiles!day_plans_user_id_fkey(username, full_name, avatar_url), ${COMPANIONS_SELECT}`,
      )
      .eq("festival_id", festivalId)
      .neq("user_id", userId)
      .gte("date", fromDate)
      .or("status.is.null,status.not.in.(cancelled,expired)");

    if (error) {
      throw new DatabaseError(`Failed to list friends going: ${error.message}`);
    }

    return groupFriendsGoing(
      data.map((row) => ({
        date: row.date,
        userId: row.user_id,
        username: row.profiles?.username ?? null,
        fullName: row.profiles?.full_name ?? null,
        avatarUrl: row.profiles?.avatar_url ?? null,
        kind: row.kind as DayPlanKind,
        tentName: row.tents?.name ?? null,
        startAt: row.start_at,
        note: row.note,
        companions: mapCompanions(row.day_plan_companions as CompanionRow[] | null),
      })),
    );
  }
}
