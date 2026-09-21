import type { Database } from "@prostcounter/db";
import type { Consumption, LogConsumptionInput, TipMode } from "@prostcounter/shared";
import { calculatePricePaidCents, DEFAULT_DRINK_PRICES } from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger";
import { PgErrorCode } from "../../lib/postgres-errors";
import { DatabaseError, ValidationError } from "../../middleware/error";
import type { IConsumptionRepository } from "../interfaces";

/** Matches the client-side default in useTipCalculation. */
const DEFAULT_TIP_MODE: TipMode = "ceiling_plus_1";

export class SupabaseConsumptionRepository implements IConsumptionRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Applies the user's saved tip preference to a base price.
   *
   * The tip used to be computed on the device and sent up, which meant it was
   * calculated from whatever price the client guessed. Reading the preference
   * here keeps the tip anchored to the base price the database actually
   * resolved.
   *
   * A profile that cannot be read falls back to the default mode rather than
   * failing the write: nobody should lose a drink because their tip setting
   * would not load.
   */
  private async applyTipPreference(userId: string, basePriceCents: number): Promise<number> {
    const { data } = await this.supabase
      .from("profiles")
      .select("tip_mode, tip_fixed_amount")
      .eq("id", userId)
      .single();

    return calculatePricePaidCents(
      basePriceCents,
      (data?.tip_mode as TipMode) ?? DEFAULT_TIP_MODE,
      data?.tip_fixed_amount,
    );
  }

  async create(
    userId: string,
    attendanceId: string,
    input: Omit<LogConsumptionInput, "festivalId" | "date">,
  ): Promise<Consumption> {
    const {
      tentId,
      drinkType = "beer",
      drinkName,
      pricePaidOverrideCents,
      volumeMl = 1000,
      recordedAt,
      idempotencyKey,
      consumptionId,
    } = input;
    // `basePriceCents` and `pricePaidCents` are deliberately not read. Every
    // client used to send one drink-type-agnostic price for every button, so a
    // soft drink was logged at the beer price. Resolving both here is what
    // makes the stored row right regardless of which binary sent it.

    // Get festival_id from attendance
    const { data: attendance, error: attError } = await this.supabase
      .from("attendances")
      .select("festival_id")
      .eq("id", attendanceId)
      .single();

    if (attError || !attendance) {
      throw new DatabaseError(
        `Failed to fetch attendance: ${attError?.message || "No data returned"}`,
      );
    }

    // Use database function for price resolution (handles cascade)
    const { data: price, error: priceError } = await this.supabase.rpc("get_drink_price_cents", {
      p_festival_id: attendance.festival_id,
      p_tent_id: tentId,
      p_drink_type: drinkType,
    });

    // If the cascade cannot answer, fall back per drink type rather than to a
    // single number: a flat beer price here would recreate the exact bug this
    // resolution exists to prevent, just on a rarer path. Losing the write
    // instead is worse, since an offline push would drop the user's drink.
    const finalBasePriceCents =
      priceError || price === null ? DEFAULT_DRINK_PRICES[drinkType] : price;

    if (priceError) {
      logger.error(
        { festivalId: attendance.festival_id, tentId, drinkType, error: priceError.message },
        "get_drink_price_cents failed; stored the system default for this drink type",
      );
    }

    const finalPricePaidCents =
      pricePaidOverrideCents !== undefined
        ? pricePaidOverrideCents
        : await this.applyTipPreference(userId, finalBasePriceCents);

    if (finalPricePaidCents < finalBasePriceCents) {
      throw new ValidationError(ErrorCodes.PRICE_BELOW_BASE);
    }

    const { data, error } = await this.supabase
      .from("consumptions")
      .insert({
        // Only set when the caller supplied one; otherwise let Postgres mint it,
        // so web callers keep the behaviour they have always had.
        ...(consumptionId ? { id: consumptionId } : {}),
        attendance_id: attendanceId,
        tent_id: tentId || null,
        drink_type: drinkType,
        drink_name: drinkName || null,
        base_price_cents: finalBasePriceCents,
        price_paid_cents: finalPricePaidCents,
        volume_ml: volumeMl,
        recorded_at: recordedAt || new Date().toISOString(),
        idempotency_key: idempotencyKey || null,
      })
      .select()
      .single();

    if (error || !data) {
      // A client-supplied id that already exists is a replay of a push whose
      // response the device never saw, not a second drink. Return the stored row
      // so the retry settles instead of failing forever or duplicating.
      if (consumptionId && error?.code === PgErrorCode.UNIQUE_VIOLATION) {
        const replayed = await this.findStoredById(consumptionId, attendanceId);
        if (replayed) {
          return replayed;
        }
      }

      throw new DatabaseError(
        `Failed to create consumption: ${error?.message || "No data returned"}`,
      );
    }

    return this.mapToConsumption(data);
  }

  /**
   * The stored consumption behind a replayed id, or null if it is not this
   * attendance's to return.
   *
   * Scoped to the attendance so a client cannot probe another user's rows by
   * guessing ids: a collision on someone else's consumption reads as "not found"
   * and falls through to the error path rather than handing back their drink.
   */
  private async findStoredById(id: string, attendanceId: string): Promise<Consumption | null> {
    const { data, error } = await this.supabase
      .from("consumptions")
      .select("*")
      .eq("id", id)
      .eq("attendance_id", attendanceId)
      .maybeSingle();

    if (error || !data) {
      return null;
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
      if (attError.code === PgErrorCode.NO_ROWS) {
        return [];
      }
      throw new DatabaseError(`Failed to fetch attendance: ${attError.message}`);
    }

    // Get consumptions for this attendance
    return this.findByAttendance(attendance.id);
  }

  async delete(id: string, userId: string): Promise<void> {
    // Verify ownership only if the row exists. A missing row is treated as
    // idempotent success so retries from the offline queue (where the local
    // record may have never been pushed) don't loop on 500s.
    const { data: consumption, error: fetchError } = await this.supabase
      .from("consumptions")
      .select("attendance_id, attendances(user_id)")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      throw new DatabaseError(`Failed to fetch consumption: ${fetchError.message}`);
    }

    if (!consumption) {
      return;
    }

    if ((consumption.attendances as any)?.user_id !== userId) {
      throw new DatabaseError("Unauthorized to delete this consumption");
    }

    const { data: deleted, error } = await this.supabase
      .from("consumptions")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      throw new DatabaseError(`Failed to delete consumption: ${error.message}`);
    }

    if (!deleted || deleted.length === 0) {
      throw new DatabaseError(
        `Consumption delete affected 0 rows for id=${id}; likely RLS policy or FK constraint`,
      );
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
