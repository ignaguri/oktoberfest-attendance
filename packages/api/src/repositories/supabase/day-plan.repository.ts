import type { Database, Tables, TablesUpdate } from "@prostcounter/db";
import type {
  DayPlan,
  DayPlanKind,
  FriendsGoingDay,
  ReservationStatus,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { groupFriendsGoing } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PgErrorCode } from "../../lib/postgres-errors";
import { ConflictError, DatabaseError, NotFoundError } from "../../middleware/error";
import type { DayPlanWrite, FestivalDayContext, IDayPlanRepository } from "../interfaces";

/** PostgREST filter for rows that still count as the day's mark. */
export const ACTIVE_DAY_PLAN_FILTER = "status.is.null,status.neq.cancelled";

const DAY_PLAN_SELECT = "*, tents(name)";

type DayPlanRowWithTent = Tables<"day_plans"> & { tents: { name: string } | null };

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

  async listFriendsGoing(
    userId: string,
    festivalId: string,
    fromDate: string,
  ): Promise<FriendsGoingDay[]> {
    const { data, error } = await this.supabase
      .from("day_plans")
      .select(
        "user_id, date, kind, start_at, note, tents(name), profiles!day_plans_user_id_fkey(username, full_name, avatar_url)",
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
      })),
    );
  }
}
