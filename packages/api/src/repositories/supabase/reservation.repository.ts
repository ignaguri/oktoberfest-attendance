import type { Database, TablesUpdate } from "@prostcounter/db";
import type {
  CreateReservationInput,
  Reservation,
  ReservationStatus,
  UpdateReservationInput,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { formatDateForDatabase } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PgErrorCode } from "../../lib/postgres-errors";
import {
  ConflictError,
  DatabaseError,
  ForbiddenError,
  NotFoundError,
} from "../../middleware/error";
import type { IReservationRepository } from "../interfaces/reservation.repository";
import { ACTIVE_DAY_PLAN_FILTER } from "./day-plan.repository";

/**
 * Reservations live in day_plans as kind = 'reservation'.
 *
 * This keeps the /reservations contract exactly as released mobile builds
 * expect it, while a day holds at most one active mark (plan or reservation).
 */
export class SupabaseReservationRepository implements IReservationRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(userId: string, input: CreateReservationInput): Promise<Reservation> {
    const timezone = await this.getFestivalTimezone(input.festivalId);
    const date = formatDateForDatabase(new Date(input.startAt), timezone);

    const { data: existing, error: existingError } = await this.supabase
      .from("day_plans")
      .select("id, kind, note")
      .eq("user_id", userId)
      .eq("festival_id", input.festivalId)
      .eq("date", date)
      .or(ACTIVE_DAY_PLAN_FILTER)
      .maybeSingle();

    if (existingError) {
      throw new DatabaseError(`Failed to check the day's plan: ${existingError.message}`);
    }
    if (existing?.kind === "reservation") {
      throw new ConflictError(ErrorCodes.DAY_PLAN_CONFLICT);
    }

    const reservationFields = {
      kind: "reservation",
      tent_id: input.tentId,
      start_at: input.startAt,
      end_at: input.endAt || null,
      // An older client reserving a day it had planned should not wipe the
      // plan's note ("with the office crew") just because it sent none.
      note: input.note || existing?.note || null,
      visible_to_groups: input.visibleToGroups ?? true,
      auto_checkin: input.autoCheckin ?? false,
      reminder_offset_minutes: input.reminderOffsetMinutes ?? 30,
      status: "pending",
    };

    if (existing) {
      const { data, error } = await this.supabase
        .from("day_plans")
        .update(reservationFields)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select("*, tents(name)")
        .single();

      if (error || !data) {
        throw new DatabaseError(
          `Failed to create reservation: ${error?.message || "No data returned"}`,
        );
      }

      return this.mapToReservation(data);
    }

    const { data, error } = await this.supabase
      .from("day_plans")
      .insert({
        ...reservationFields,
        user_id: userId,
        festival_id: input.festivalId,
        date,
      })
      .select("*, tents(name)")
      .single();

    if (error?.code === PgErrorCode.UNIQUE_VIOLATION) {
      throw new ConflictError(ErrorCodes.DAY_PLAN_CONFLICT);
    }
    if (error || !data) {
      throw new DatabaseError(
        `Failed to create reservation: ${error?.message || "No data returned"}`,
      );
    }

    return this.mapToReservation(data);
  }

  async findById(id: string, userId: string): Promise<Reservation | null> {
    const { data, error } = await this.supabase
      .from("day_plans")
      .select("*, tents(name)")
      .eq("id", id)
      .eq("user_id", userId)
      .eq("kind", "reservation")
      .single();

    if (error && error.code !== PgErrorCode.NO_ROWS) {
      throw new DatabaseError(`Failed to fetch reservation: ${error.message}`);
    }

    if (!data) return null;

    return this.mapToReservation(data);
  }

  async list(
    userId: string,
    festivalId?: string,
    status?: ReservationStatus,
    upcoming?: boolean,
    limit = 50,
    offset = 0,
  ): Promise<{ data: Reservation[]; total: number }> {
    let query = this.supabase
      .from("day_plans")
      .select("*, tents(name)", { count: "exact" })
      .eq("user_id", userId)
      .eq("kind", "reservation")
      .order("start_at", { ascending: false });

    if (festivalId) {
      query = query.eq("festival_id", festivalId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (upcoming) {
      query = query.gte("start_at", new Date().toISOString());
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      throw new DatabaseError(`Failed to list reservations: ${error.message}`);
    }

    return {
      data: data.map((r) => this.mapToReservation(r)),
      total: count || 0,
    };
  }

  async checkin(id: string, userId: string): Promise<Reservation> {
    // First verify ownership
    const reservation = await this.findById(id, userId);
    if (!reservation) {
      throw new NotFoundError("Reservation not found");
    }

    if (reservation.status === "checked_in") {
      return reservation; // Already checked in, return as-is
    }

    if (reservation.status === "cancelled" || reservation.status === "expired") {
      throw new ForbiddenError("Cannot check in to a cancelled or expired reservation");
    }

    const { data, error } = await this.supabase
      .from("day_plans")
      .update({
        status: "checked_in",
        processed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("kind", "reservation")
      .select("*, tents(name)")
      .single();

    if (error || !data) {
      throw new DatabaseError(`Failed to check in: ${error?.message || "No data returned"}`);
    }

    return this.mapToReservation(data);
  }

  async cancel(id: string, userId: string): Promise<Reservation> {
    const { data, error } = await this.supabase
      .from("day_plans")
      .update({
        status: "cancelled",
        processed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("kind", "reservation")
      .select("*, tents(name)")
      .single();

    if (error || !data) {
      throw new DatabaseError(
        `Failed to cancel reservation: ${error?.message || "No data returned"}`,
      );
    }

    return this.mapToReservation(data);
  }

  async update(id: string, userId: string, input: UpdateReservationInput): Promise<Reservation> {
    // Build update object with only provided fields
    const updateData: TablesUpdate<"day_plans"> = {};

    if (input.startAt !== undefined) {
      const current = await this.findById(id, userId);
      if (!current) {
        throw new NotFoundError("Reservation not found");
      }
      const timezone = await this.getFestivalTimezone(current.festivalId);
      updateData.start_at = input.startAt;
      updateData.date = formatDateForDatabase(new Date(input.startAt), timezone);
    }
    if (input.endAt !== undefined) {
      updateData.end_at = input.endAt;
    }
    if (input.note !== undefined) {
      updateData.note = input.note;
    }
    if (input.visibleToGroups !== undefined) {
      updateData.visible_to_groups = input.visibleToGroups;
    }
    if (input.autoCheckin !== undefined) {
      updateData.auto_checkin = input.autoCheckin;
    }
    if (input.reminderOffsetMinutes !== undefined) {
      updateData.reminder_offset_minutes = input.reminderOffsetMinutes;
    }

    if (Object.keys(updateData).length === 0) {
      // Nothing to update, just return current reservation
      const existing = await this.findById(id, userId);
      if (!existing) {
        throw new NotFoundError("Reservation not found");
      }
      return existing;
    }

    const { data, error } = await this.supabase
      .from("day_plans")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .eq("kind", "reservation")
      .select("*, tents(name)")
      .single();

    if (error || !data) {
      if (error?.code === PgErrorCode.NO_ROWS) {
        throw new NotFoundError("Reservation not found");
      }
      if (error?.code === PgErrorCode.UNIQUE_VIOLATION) {
        throw new ConflictError(ErrorCodes.DAY_PLAN_CONFLICT);
      }
      throw new DatabaseError(
        `Failed to update reservation: ${error?.message || "No data returned"}`,
      );
    }

    return this.mapToReservation(data);
  }

  async getUpcomingForReminders(beforeMinutes: number): Promise<Reservation[]> {
    const now = new Date();
    const futureTime = new Date(now.getTime() + beforeMinutes * 60 * 1000);

    const { data, error } = await this.supabase
      .from("day_plans")
      .select("*, tents(name)")
      .eq("kind", "reservation")
      .eq("status", "pending")
      .gte("start_at", now.toISOString())
      .lte("start_at", futureTime.toISOString())
      .is("reminder_sent_at", null);

    if (error) {
      throw new DatabaseError(`Failed to fetch upcoming reservations: ${error.message}`);
    }

    return data.map((r) => this.mapToReservation(r));
  }

  private async getFestivalTimezone(festivalId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select("timezone")
      .eq("id", festivalId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to fetch festival: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundError(ErrorCodes.FESTIVAL_NOT_FOUND);
    }

    return data.timezone;
  }

  private mapToReservation(data: any): Reservation {
    return {
      id: data.id,
      userId: data.user_id,
      festivalId: data.festival_id,
      tentId: data.tent_id,
      tentName: data.tents?.name,
      startAt: data.start_at,
      endAt: data.end_at,
      status: data.status as ReservationStatus,
      note: data.note,
      visibleToGroups: data.visible_to_groups,
      autoCheckin: data.auto_checkin,
      reminderOffsetMinutes: data.reminder_offset_minutes,
      reminderSentAt: data.reminder_sent_at,
      promptSentAt: data.prompt_sent_at,
      processedAt: data.processed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
