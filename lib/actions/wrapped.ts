"use server";

import { logger } from "@/lib/logger";
import { getUser } from "@/lib/sharedActions";
import { ACCESS_CONFIG } from "@/lib/wrapped/config";
import { createClient } from "@/utils/supabase/server";

import type { WrappedData, WrappedAccessResult } from "@/lib/wrapped/types";

/**
 * Get wrapped data for a user and festival
 */
export async function getWrappedData(
  festivalId: string,
): Promise<WrappedData | null> {
  try {
    const user = await getUser();
    const supabase = await createClient();

    // Call the database function
    const { data, error } = await supabase.rpc("get_wrapped_data", {
      p_user_id: user.id,
      p_festival_id: festivalId,
    });

    if (error) {
      logger.error(
        "Failed to fetch wrapped data from database",
        logger.serverAction("getWrappedData", {
          userId: user.id,
          festivalId,
        }),
        error,
      );
      return null;
    }

    if (!data) {
      logger.info(
        "No wrapped data found for user and festival",
        logger.serverAction("getWrappedData", {
          userId: user.id,
          festivalId,
        }),
      );
      return null;
    }

    return data as unknown as WrappedData;
  } catch (error) {
    logger.error(
      "Unexpected error fetching wrapped data",
      logger.serverAction("getWrappedData", { festivalId }),
      error instanceof Error ? error : undefined,
    );
    return null;
  }
}

/**
 * Check if user can access wrapped for a festival
 */
export async function canAccessWrapped(
  festivalId: string,
): Promise<WrappedAccessResult> {
  try {
    const user = await getUser();
    const supabase = await createClient();

    // Allow in development environment
    if (ACCESS_CONFIG.allowInDev && process.env.NODE_ENV === "development") {
      logger.info(
        "Allowing wrapped access in development mode",
        logger.serverAction("canAccessWrapped", {
          festivalId,
          userId: user.id,
        }),
      );
      return { allowed: true };
    }

    // Get festival to check status
    const { data: festival, error: festivalError } = await supabase
      .from("festivals")
      .select("id, name, status, start_date, end_date")
      .eq("id", festivalId)
      .single();

    if (festivalError || !festival) {
      logger.error(
        "Failed to fetch festival for wrapped access check",
        logger.serverAction("canAccessWrapped", { festivalId }),
        festivalError,
      );
      return {
        allowed: false,
        reason: "error",
        message: "Could not verify festival information",
      };
    }

    // Check if festival has ended
    if (ACCESS_CONFIG.requireFestivalEnded && festival.status !== "ended") {
      return {
        allowed: false,
        reason: "not_ended",
        message: `Wrapped will be available after ${festival.name} ends`,
      };
    }

    // Check if user has any attendance data
    const { data: attendances, error: attendanceError } = await supabase
      .from("attendances")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("festival_id", festivalId);

    if (attendanceError) {
      logger.error(
        "Failed to check user attendance for wrapped",
        logger.serverAction("canAccessWrapped", {
          festivalId,
          userId: user.id,
        }),
        attendanceError,
      );
      return {
        allowed: false,
        reason: "error",
        message: "Could not verify your festival attendance",
      };
    }

    // Check minimum days requirement
    if (
      ACCESS_CONFIG.minAttendanceDays > 0 &&
      (!attendances ||
        (attendances as unknown as number) < ACCESS_CONFIG.minAttendanceDays)
    ) {
      return {
        allowed: false,
        reason: "no_data",
        message: `You need at least ${ACCESS_CONFIG.minAttendanceDays} day(s) of attendance to view your wrapped`,
      };
    }

    return { allowed: true };
  } catch (error) {
    logger.error(
      "Unexpected error checking wrapped access",
      logger.serverAction("canAccessWrapped", { festivalId }),
      error instanceof Error ? error : undefined,
    );
    return {
      allowed: false,
      reason: "error",
      message: "An unexpected error occurred",
    };
  }
}

/**
 * Get list of festivals with wrapped available for current user
 */
export async function getAvailableWrappedFestivals(): Promise<
  Array<{
    id: string;
    name: string;
    year: number;
    status: string;
    hasData: boolean;
  }>
> {
  try {
    const user = await getUser();
    const supabase = await createClient();

    // In development, show all festivals
    // In production, only show ended festivals
    const festivalQuery = supabase
      .from("festivals")
      .select("id, name, start_date, status")
      .order("start_date", { ascending: false });

    if (!ACCESS_CONFIG.allowInDev || process.env.NODE_ENV !== "development") {
      festivalQuery.eq("status", "ended");
    }

    const { data: festivals, error: festivalsError } = await festivalQuery;

    if (festivalsError || !festivals) {
      logger.error(
        "Failed to fetch festivals for wrapped",
        logger.serverAction("getAvailableWrappedFestivals"),
        festivalsError,
      );
      return [];
    }

    // Check which festivals user has data for
    const { data: userAttendances, error: attendanceError } = await supabase
      .from("attendances")
      .select("festival_id")
      .eq("user_id", user.id);

    if (attendanceError) {
      logger.error(
        "Failed to fetch user attendances for wrapped",
        logger.serverAction("getAvailableWrappedFestivals", {
          userId: user.id,
        }),
        attendanceError,
      );
      return [];
    }

    const festivalIdsWithData = new Set(
      (userAttendances || []).map((a) => a.festival_id),
    );

    return festivals.map((festival) => ({
      id: festival.id,
      name: festival.name,
      year: new Date(festival.start_date).getFullYear(),
      status: festival.status,
      hasData: festivalIdsWithData.has(festival.id),
    }));
  } catch (error) {
    logger.error(
      "Unexpected error fetching available wrapped festivals",
      logger.serverAction("getAvailableWrappedFestivals"),
      error instanceof Error ? error : undefined,
    );
    return [];
  }
}
