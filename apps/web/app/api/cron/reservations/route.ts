import { DEV_URL, IS_PROD, PROD_URL } from "@prostcounter/shared/constants";
import { NextResponse } from "next/server";

import { createNotificationService } from "@/lib/services/notifications";
import { createClient } from "@/utils/supabase/server";

import { processReservationNotifications } from "../scheduler/reservations";

export const runtime = "nodejs";

// Called every 5 minutes by the pg_cron job `reservation-notifications`
// (see migration 20260930103634_reservation_reminders_cron.sql). Vercel Hobby
// crons can only run daily, which sent reminders up to a day late.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("x-cron-secret");
  if (!secret || header !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = await createClient(true);
  const notifications = createNotificationService();
  const baseUrl = IS_PROD ? PROD_URL : DEV_URL;

  await processReservationNotifications(
    supabase,
    notifications,
    baseUrl,
    new Date().toISOString(),
  );

  return NextResponse.json({ ok: true });
}
