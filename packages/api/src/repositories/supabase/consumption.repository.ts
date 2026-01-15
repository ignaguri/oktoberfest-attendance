import type { IConsumptionRepository } from "../interfaces";
import type { Database } from "@prostcounter/db";
import type { Consumption, LogConsumptionInput } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";

export class SupabaseConsumptionRepository implements IConsumptionRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async create(
    userId: string,
    attendanceId: string,
    input: Omit<LogConsumptionInput, "festivalId" | "date">,
  ): Promise<Consumption> {
    const {
      tentId,
      drinkType = "beer",
      drinkName,
      basePriceCents,
      pricePaidCents,
      volumeMl = 1000,
      recordedAt,
      idempotencyKey,
    } = input;

    // If base price not provided, use the pricing cascade (tent -> festival -> default)
    let finalBasePriceCents: number;
    if (basePriceCents !== undefined) {
      finalBasePriceCents = basePriceCents;
    } else {
      // Get festival_id from attendance
      const { data: attendance, error: attError } = await this.supabase
        .from("attendances")
        .select("festival_id")
        .eq("id", attendanceId)
        .single();

      if (attError) {
        throw new DatabaseError(
          `Failed to fetch attendance: ${attError.message}`,
        );
      }

      // Use database function for price resolution (handles cascade)
      const { data: price, error: priceError } = await this.supabase.rpc(
        "get_drink_price_cents",
        {
          p_festival_id: attendance.festival_id,
          p_tent_id: tentId,
          p_drink_type: drinkType,
        },
      );

      if (priceError || price === null) {
        // Fallback to system default
        finalBasePriceCents = 1620;
      } else {
        finalBasePriceCents = price;
      }
    }

    const { data, error } = await this.supabase
      .from("consumptions")
      .insert({
        attendance_id: attendanceId,
        tent_id: tentId || null,
        drink_type: drinkType,
        drink_name: drinkName || null,
        base_price_cents: finalBasePriceCents,
        price_paid_cents: pricePaidCents,
        volume_ml: volumeMl,
        recorded_at: recordedAt || new Date().toISOString(),
        idempotency_key: idempotencyKey || null,
      })
      .select()
      .single();

    if (error) {
      throw new DatabaseError(`Failed to create consumption: ${error.message}`);
    }

    return this.mapToConsumption(data);
  }

  async findByAttendance(attendanceId: string): Promise<Consumption[]> {
    const { data, error } = await this.supabase
      .from("consumptions")
      .select("*")
      .eq("attendance_id", attendanceId)
      .order("recorded_at", { ascending: false });

    if (error) {
      throw new DatabaseError(`Failed to fetch consumptions: ${error.message}`);
    }

    return data.map((item) => this.mapToConsumption(item));
  }

  async findByFestivalAndDate(
    userId: string,
    festivalId: string,
    date: string,
  ): Promise<Consumption[]> {
    // First get the attendance for this user/festival/date
    const { data: attendance, error: attError } = await this.supabase
      .from("attendances")
      .select("id")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .eq("date", date)
      .single();

    if (attError) {
      // No attendance found means no consumptions
      if (attError.code === "PGRST116") {
        return [];
      }
      throw new DatabaseError(
        `Failed to fetch attendance: ${attError.message}`,
      );
    }

    // Get consumptions for this attendance
    return this.findByAttendance(attendance.id);
  }

  async delete(id: string, userId: string): Promise<void> {
    // First verify the consumption belongs to the user
    const { data: consumption, error: fetchError } = await this.supabase
      .from("consumptions")
      .select("attendance_id, attendances(user_id)")
      .eq("id", id)
      .single();

    if (fetchError) {
      throw new DatabaseError(
        `Failed to fetch consumption: ${fetchError.message}`,
      );
    }

    if ((consumption.attendances as any)?.user_id !== userId) {
      throw new DatabaseError("Unauthorized to delete this consumption");
    }

    const { error } = await this.supabase
      .from("consumptions")
      .delete()
      .eq("id", id);

    if (error) {
      throw new DatabaseError(`Failed to delete consumption: ${error.message}`);
    }
  }

  private mapToConsumption(data: any): Consumption {
    return {
      id: data.id,
      attendanceId: data.attendance_id,
      tentId: data.tent_id,
      drinkType: data.drink_type,
      drinkName: data.drink_name,
      basePriceCents: data.base_price_cents,
      pricePaidCents: data.price_paid_cents,
      tipCents: data.tip_cents,
      volumeMl: data.volume_ml,
      recordedAt: data.recorded_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
