import type { Database } from "@prostcounter/db";
import type { AdminFeedbackItem, FeedbackKind } from "@prostcounter/shared";
import { TIMEZONE } from "@prostcounter/shared/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";
import type {
  FeedbackInsert,
  FeedbackPromptOutcome,
  FeedbackSubmitter,
  IFeedbackRepository,
  LoggedDay,
  PromptRecord,
} from "../interfaces";

const UNIQUE_VIOLATION = "23505";

/** PostgREST returns a to-one embed as an object, but the generated types allow an array. */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export class SupabaseFeedbackRepository implements IFeedbackRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async listLoggedDaysSince(userId: string, sinceDay: string): Promise<LoggedDay[]> {
    // attendance_with_totals is security_invoker: RLS keeps this to the caller's rows
    const { data: rows, error } = await this.supabase
      .from("attendance_with_totals")
      .select("festival_id, date")
      .eq("user_id", userId)
      .gte("date", sinceDay)
      .gt("drink_count", 0);
    if (error) {
      throw new DatabaseError(`Failed to read logged days: ${error.message}`);
    }

    const loggedRows = (rows ?? []).filter(
      (row): row is { festival_id: string; date: string } => !!row.festival_id && !!row.date,
    );
    if (loggedRows.length === 0) {
      return [];
    }

    const festivalIds = [...new Set(loggedRows.map((row) => row.festival_id))];
    const { data: festivals, error: festivalError } = await this.supabase
      .from("festivals")
      .select("id, name, timezone")
      .in("id", festivalIds);
    if (festivalError) {
      throw new DatabaseError(`Failed to read festivals: ${festivalError.message}`);
    }

    const festivalsById = new Map((festivals ?? []).map((festival) => [festival.id, festival]));
    return loggedRows.flatMap((row) => {
      const festival = festivalsById.get(row.festival_id);
      if (!festival) {
        return [];
      }
      return [
        {
          festivalId: festival.id,
          festivalName: festival.name,
          timezone: festival.timezone ?? TIMEZONE,
          day: row.date,
        },
      ];
    });
  }

  async countLoggedDays(userId: string, festivalId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("attendance_with_totals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .gt("drink_count", 0);
    if (error) {
      throw new DatabaseError(`Failed to count logged days: ${error.message}`);
    }
    return count ?? 0;
  }

  async hasLoggedDay(userId: string, festivalId: string, day: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("attendance_with_totals")
      .select("id")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .eq("date", day)
      .gt("drink_count", 0)
      .limit(1);
    if (error) {
      throw new DatabaseError(`Failed to check logged day: ${error.message}`);
    }
    return (data ?? []).length > 0;
  }

  async listPrompts(userId: string): Promise<PromptRecord[]> {
    const { data, error } = await this.supabase
      .from("feedback_prompts")
      .select("festival_id, day, outcome, created_at")
      .eq("user_id", userId);
    if (error) {
      throw new DatabaseError(`Failed to read feedback prompts: ${error.message}`);
    }
    return (data ?? []).map((row) => ({
      festivalId: row.festival_id,
      day: row.day,
      outcome: row.outcome as FeedbackPromptOutcome,
      createdAt: row.created_at,
    }));
  }

  async recordPrompt(
    userId: string,
    festivalId: string,
    day: string,
    outcome: FeedbackPromptOutcome,
  ): Promise<void> {
    // DO NOTHING on conflict: the first outcome for a day stands
    const { error } = await this.supabase
      .from("feedback_prompts")
      .upsert(
        { user_id: userId, festival_id: festivalId, day, outcome },
        { onConflict: "user_id,festival_id,day", ignoreDuplicates: true },
      );
    if (error) {
      throw new DatabaseError(`Failed to record feedback prompt: ${error.message}`);
    }
  }

  async insertFeedback(row: FeedbackInsert): Promise<"inserted" | "duplicate"> {
    const { error } = await this.supabase.from("feedback").insert({
      id: row.id,
      user_id: row.userId,
      kind: row.kind,
      rating: row.rating,
      message: row.message,
      festival_id: row.festivalId,
      day: row.day,
      platform: row.platform,
      app_version: row.appVersion,
      locale: row.locale,
    });
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return "duplicate";
      }
      throw new DatabaseError(`Failed to store feedback: ${error.message}`);
    }
    return "inserted";
  }

  async findDayFeedbackId(userId: string, festivalId: string, day: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("feedback")
      .select("id")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .eq("day", day)
      .eq("kind", "day")
      .maybeSingle();
    if (error) {
      throw new DatabaseError(`Failed to read day feedback: ${error.message}`);
    }
    return data?.id ?? null;
  }

  async countSubmissionsSince(
    userId: string,
    kinds: FeedbackKind[],
    sinceIso: string,
  ): Promise<number> {
    const { count, error } = await this.supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("kind", kinds)
      .gte("created_at", sinceIso);
    if (error) {
      throw new DatabaseError(`Failed to count feedback: ${error.message}`);
    }
    return count ?? 0;
  }

  async getSubmitter(userId: string): Promise<FeedbackSubmitter> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("username, preferred_language")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      throw new DatabaseError(`Failed to read profile: ${error.message}`);
    }
    return {
      username: data?.username ?? null,
      preferredLanguage: data?.preferred_language ?? null,
    };
  }

  async getFestivalName(festivalId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select("name")
      .eq("id", festivalId)
      .maybeSingle();
    if (error) {
      throw new DatabaseError(`Failed to read festival: ${error.message}`);
    }
    return data?.name ?? null;
  }

  async listForAdmin(query: { kind?: FeedbackKind; limit: number }): Promise<AdminFeedbackItem[]> {
    let request = this.supabase
      .from("feedback")
      .select(
        "id, kind, rating, message, festival_id, day, platform, app_version, locale, created_at, user_id, profiles(username, full_name), festivals(name)",
      )
      .order("created_at", { ascending: false })
      .limit(query.limit);
    if (query.kind) {
      request = request.eq("kind", query.kind);
    }

    const { data, error } = await request;
    if (error) {
      throw new DatabaseError(`Failed to list feedback: ${error.message}`);
    }

    return (data ?? []).map((row) => {
      const profile = firstOf(row.profiles);
      const festival = firstOf(row.festivals);
      return {
        id: row.id,
        kind: row.kind as FeedbackKind,
        rating: row.rating,
        message: row.message,
        festivalId: row.festival_id,
        festivalName: festival?.name ?? null,
        day: row.day,
        platform: row.platform,
        appVersion: row.app_version,
        locale: row.locale,
        createdAt: row.created_at,
        user: {
          id: row.user_id,
          username: profile?.username ?? null,
          fullName: profile?.full_name ?? null,
        },
      };
    });
  }
}
