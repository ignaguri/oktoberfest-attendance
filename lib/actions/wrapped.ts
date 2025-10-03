"use server";

import { getCurrentFestivalForUser } from "@/lib/festivalActions";
import { logger } from "@/lib/logger";
import { getUser } from "@/lib/sharedActions";
import { ACCESS_CONFIG } from "@/lib/wrapped/config";
import { createClient } from "@/utils/supabase/server";

import type { WrappedData, WrappedAccessResult } from "@/lib/wrapped/types";

/**
 * Get wrapped data for a user and festival (uses cache when available)
 */
export async function getWrappedData(
  festivalId?: string,
): Promise<WrappedData | null> {
  try {
    const user = await getUser();
    const supabase = await createClient();

    // If no festivalId provided, get the current festival
    let targetFestivalId = festivalId;
    if (!targetFestivalId) {
      const currentFestival = await getCurrentFestivalForUser();
      if (!currentFestival) {
        logger.error(
          "No current festival found for wrapped data",
          logger.serverAction("getWrappedData", { userId: user.id }),
        );
        return null;
      }
      targetFestivalId = currentFestival.id;
    }

    // Call the cached database function (checks cache first, calculates if needed)
    const { data, error } = await supabase.rpc("get_wrapped_data_cached", {
      p_user_id: user.id,
      p_festival_id: targetFestivalId,
    });

    if (error) {
      logger.error(
        "Failed to fetch wrapped data from database (cached)",
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
  festivalId?: string,
): Promise<WrappedAccessResult> {
  try {
    const user = await getUser();
    const supabase = await createClient();

    // If no festivalId provided, get the current festival
    let targetFestivalId = festivalId;
    if (!targetFestivalId) {
      const currentFestival = await getCurrentFestivalForUser();
      if (!currentFestival) {
        logger.error(
          "No current festival found for wrapped access check",
          logger.serverAction("canAccessWrapped", { userId: user.id }),
        );
        return {
          allowed: false,
          reason: "error",
          message: "Could not determine current festival",
        };
      }
      targetFestivalId = currentFestival.id;
    }

    const isAllowedUser = ACCESS_CONFIG.allowedUsers.includes(user.id);
    if (isAllowedUser) {
      return { allowed: true };
    }

    // Allow in development environment
    if (ACCESS_CONFIG.allowInDev && process.env.NODE_ENV === "development") {
      logger.info(
        "Allowing wrapped access in development mode",
        logger.serverAction("canAccessWrapped", {
          festivalId: targetFestivalId,
          userId: user.id,
        }),
      );
      return { allowed: true };
    }

    // Get festival to check status
    const { data: festival, error: festivalError } = await supabase
      .from("festivals")
      .select("id, name, status, start_date, end_date")
      .eq("id", targetFestivalId)
      .single();

    if (festivalError || !festival) {
      logger.error(
        "Failed to fetch festival for wrapped access check",
        logger.serverAction("canAccessWrapped", {
          festivalId: targetFestivalId,
        }),
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
      .eq("festival_id", targetFestivalId);

    if (attendanceError) {
      logger.error(
        "Failed to check user attendance for wrapped",
        logger.serverAction("canAccessWrapped", {
          festivalId: targetFestivalId,
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

/**
 * Admin function to regenerate cached wrapped data
 * @param festivalId - Optional: regenerate cache for specific festival only
 * @param userId - Optional: regenerate cache for specific user only
 */
export async function regenerateWrappedCache(
  festivalId?: string,
  userId?: string,
): Promise<{ success: boolean; regeneratedCount?: number; error?: string }> {
  try {
    const currentUser = await getUser();
    const supabase = await createClient();

    // Verify admin permissions using the same method as middleware.ts
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", currentUser.id)
      .single();

    if (!profile?.is_super_admin) {
      return {
        success: false,
        error: "Insufficient permissions to regenerate cache",
      };
    }

    // Call the database function to regenerate cache
    const { data: regeneratedCount, error } = await supabase.rpc(
      "regenerate_wrapped_data_cache",
      {
        p_user_id: userId || undefined,
        p_festival_id: festivalId || undefined,
        p_admin_user_id: currentUser.id,
      },
    );

    if (error) {
      logger.error(
        "Failed to regenerate wrapped cache",
        logger.serverAction("regenerateWrappedCache", {
          festivalId,
          userId,
          adminUserId: currentUser.id,
        }),
        error,
      );
      return {
        success: false,
        error: error.message || "Failed to regenerate cache",
      };
    }

    logger.info(
      "Successfully regenerated wrapped cache",
      logger.serverAction("regenerateWrappedCache", {
        festivalId,
        userId,
        regeneratedCount,
        adminUserId: currentUser.id,
      }),
    );

    return {
      success: true,
      regeneratedCount,
    };
  } catch (error) {
    logger.error(
      "Unexpected error regenerating wrapped cache",
      logger.serverAction("regenerateWrappedCache", { festivalId, userId }),
      error instanceof Error ? error : undefined,
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error",
    };
  }
}
