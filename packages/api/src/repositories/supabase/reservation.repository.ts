import type { IReservationRepository } from "../interfaces/reservation.repository";
import type { Database } from "@prostcounter/db";
import type {
  Reservation,
  CreateReservationInput,
  ReservationStatus,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DatabaseError,
  NotFoundError,
  ForbiddenError,
} from "../../middleware/error";

export class SupabaseReservationRepository implements IReservationRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(
    userId: string,
    input: CreateReservationInput,
  ): Promise<Reservation> {
    const { data, error } = await this.supabase
      .from("reservations")
      .insert({
        user_id: userId,
        festival_id: input.festivalId,
        tent_id: input.tentId,
        start_at: input.startAt,
        end_at: input.endAt || null,
        note: input.note || null,
        visible_to_groups: input.visibleToGroups ?? true,
        auto_checkin: input.autoCheckin ?? false,
        reminder_offset_minutes: input.reminderOffsetMinutes ?? 30,
        status: "pending",
      })
      .select("*, tents(name)")
      .single();

    if (error) {
      throw new DatabaseError(`Failed to create reservation: ${error.message}`);
    }

    return this.mapToReservation(data);
  }

  async findById(id: string, userId: string): Promise<Reservation | null> {
    const { data, error } = await this.supabase
      .from("reservations")
      .select("*, tents(name)")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
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
      .from("reservations")
      .select("*, tents(name)", { count: "exact" })
      .eq("user_id", userId)
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

    const { data, error, count } = await query.range(
      offset,
      offset + limit - 1,
    );

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

    if (
      reservation.status === "cancelled" ||
      reservation.status === "expired"
    ) {
      throw new ForbiddenError(
        "Cannot check in to a cancelled or expired reservation",
      );
    }

    const { data, error } = await this.supabase
      .from("reservations")
      .update({
        status: "checked_in",
        processed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, tents(name)")
      .single();

    if (error) {
      throw new DatabaseError(`Failed to check in: ${error.message}`);
    }

    return this.mapToReservation(data);
  }

  async cancel(id: string, userId: string): Promise<Reservation> {
    const { data, error } = await this.supabase
      .from("reservations")
      .update({
        status: "cancelled",
        processed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, tents(name)")
      .single();

    if (error) {
      throw new DatabaseError(`Failed to cancel reservation: ${error.message}`);
    }

    return this.mapToReservation(data);
  }

  async getUpcomingForReminders(beforeMinutes: number): Promise<Reservation[]> {
    const now = new Date();
    const futureTime = new Date(now.getTime() + beforeMinutes * 60 * 1000);

    const { data, error } = await this.supabase
      .from("reservations")
      .select("*, tents(name)")
      .eq("status", "pending")
      .gte("start_at", now.toISOString())
      .lte("start_at", futureTime.toISOString())
      .is("reminder_sent_at", null);

    if (error) {
      throw new DatabaseError(
        `Failed to fetch upcoming reservations: ${error.message}`,
      );
    }

    return data.map((r) => this.mapToReservation(r));
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
