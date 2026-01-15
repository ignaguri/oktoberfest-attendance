import { createNotificationService } from "@/lib/services/notifications";
import { createClient } from "@/utils/supabase/server";
import { IS_PROD, DEV_URL, PROD_URL } from "@prostcounter/shared/constants";
import { NextResponse } from "next/server";

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

  await processReservationNotifications(
    supabase,
    notifications,
    baseUrl,
    nowIso,
  );

  await processAchievementNotifications(supabase, notifications);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return new NextResponse("OK");
}
