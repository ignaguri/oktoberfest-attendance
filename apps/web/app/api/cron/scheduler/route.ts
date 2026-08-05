import { DEV_URL, IS_PROD, PROD_URL } from "@prostcounter/shared/constants";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { createNotificationService } from "@/lib/services/notifications";
import { createClient } from "@/utils/supabase/server";

import { processAchievementNotifications } from "./achievements";
import { processReservationNotifications } from "./reservations";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("x-cron-secret");
  if (!secret || header !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = await createClient(true);
  const notifications = createNotificationService();

  const nowIso = new Date().toISOString();
  const baseUrl = IS_PROD ? PROD_URL : DEV_URL;

  await processReservationNotifications(supabase, notifications, baseUrl, nowIso);

  await processAchievementNotifications(supabase, notifications);

  // Refresh competitive standings for the active festival.
  // Past festivals are immutable and were materialised once at creation time.
  const { data: activeFestival, error: activeFestivalError } = await supabase
    .from("festivals")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (activeFestivalError) {
    logger.error(
      "Failed to look up active festival for standings refresh",
      logger.apiRoute("cron/scheduler"),
      activeFestivalError,
    );
  }

  if (activeFestival) {
    const { error: standingsError } = await supabase.rpc("refresh_festival_group_standings", {
      p_festival_id: activeFestival.id,
    });
    if (standingsError) {
      logger.error(
        "Failed to refresh festival group standings",
        logger.apiRoute("cron/scheduler", { festivalId: activeFestival.id }),
        standingsError,
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return new NextResponse("OK");
}
