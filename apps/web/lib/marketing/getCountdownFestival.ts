import "server-only";

import type { FestivalDates } from "@prostcounter/shared/utils";
import { formatDateForDatabase } from "@prostcounter/shared/utils";
import { createClient } from "@supabase/supabase-js";

export type CountdownFestival = FestivalDates & { name: string };

/**
 * The upcoming or live Oktoberfest, for the public landing page.
 *
 * festivals is only readable by authenticated users, so this uses the service
 * role. It deliberately avoids utils/supabase/server.ts, which reads cookies and
 * would opt the statically rendered landing page into dynamic rendering.
 */
export async function getCountdownFestival(): Promise<CountdownFestival | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase
    .from("festivals")
    .select("name, start_date, end_date, timezone")
    .ilike("name", "Oktoberfest%")
    .gte("end_date", formatDateForDatabase(new Date()))
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    name: data.name,
    startDate: data.start_date,
    endDate: data.end_date,
    timezone: data.timezone,
  };
}
