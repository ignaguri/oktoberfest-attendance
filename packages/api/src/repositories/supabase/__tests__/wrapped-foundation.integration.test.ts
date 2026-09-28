// Integration test: requires a running local Supabase with the Wrapped foundation migrations applied.
// Run with: pnpm --filter=@prostcounter/api test:integration wrapped-foundation
import { randomUUID } from "crypto";
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { deleteTestUsersAndFestivals } from "../../../__tests__/helpers/test-cleanup";
import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
} from "../../../__tests__/helpers/test-supabase";

let admin: SupabaseClient<Database>;
const suffix = randomUUID().slice(0, 8);
const createdFestivalIds: string[] = [];
const createdUserIds: string[] = [];

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function createFestival(
  name: string,
  startDate: string,
  endDate: string,
  timezone = "Europe/Berlin",
): Promise<string> {
  const { data, error } = await admin
    .from("festivals")
    .insert({
      name,
      short_name: `${name}-${randomUUID()}`.slice(0, 40),
      festival_type: "oktoberfest",
      start_date: startDate,
      end_date: endDate,
      beer_cost: 15.8,
      location: "Test Location",
      timezone,
      is_active: false,
      status: "upcoming",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`festival insert failed: ${error?.message}`);
  }
  createdFestivalIds.push(data.id);
  return data.id;
}

async function createSignedInUser(label: string) {
  const client = createTestSupabaseAnon();
  const { data, error } = await client.auth.signUp({
    email: `wrapped-${label}-${randomUUID()}@integration-test.com`,
    password: "test-password-123!",
  });
  if (error || !data.user || !data.session) {
    throw new Error(`signUp failed or returned no session: ${error?.message}`);
  }
  createdUserIds.push(data.user.id);
  return { id: data.user.id, client };
}

async function attend(userId: string, festivalId: string, date: string, beers: number) {
  const { data: attendance, error } = await admin
    .from("attendances")
    .insert({ user_id: userId, festival_id: festivalId, date })
    .select("id")
    .single();
  if (error || !attendance) {
    throw new Error(`attendance insert failed: ${error?.message}`);
  }
  const rows = Array.from({ length: beers }, () => ({
    attendance_id: attendance.id,
    drink_type: "beer" as const,
    base_price_cents: 1500,
    price_paid_cents: 1500,
    recorded_at: `${date}T12:00:00Z`,
  }));
  if (rows.length > 0) {
    const { error: drinkError } = await admin.from("consumptions").insert(rows);
    if (drinkError) {
      throw new Error(`consumption insert failed: ${drinkError.message}`);
    }
  }
  return attendance.id;
}

async function cacheRow(userId: string, festivalId: string) {
  const { data, error } = await admin
    .from("wrapped_data_cache")
    .select("data_version, wrapped_data, generated_by")
    .eq("user_id", userId)
    .eq("festival_id", festivalId)
    .maybeSingle();
  if (error) {
    throw new Error(`cache read failed: ${error.message}`);
  }
  return data;
}

beforeAll(() => {
  admin = createTestSupabaseAdmin();
});

afterAll(async () => {
  await deleteTestUsersAndFestivals(admin, {
    userIds: createdUserIds,
    festivalIds: createdFestivalIds,
  });
});

describe("wrapped_unlocks_at", () => {
  const cases: Array<[string, string, string]> = [
    // end_date, timezone, expected unlock instant (UTC)
    ["2026-10-04", "Europe/Berlin", "2026-10-04T22:00:00.000Z"], // CEST
    ["2026-01-10", "Europe/Berlin", "2026-01-10T23:00:00.000Z"], // CET
    ["2026-03-28", "Europe/Berlin", "2026-03-28T23:00:00.000Z"], // unlock day is the DST switch, midnight still CET
    ["2026-03-29", "Europe/Berlin", "2026-03-29T22:00:00.000Z"], // first CEST midnight
    ["2026-10-04", "America/New_York", "2026-10-05T04:00:00.000Z"],
  ];

  it.each(cases)("end %s in %s unlocks at %s", async (endDate, timezone, expected) => {
    const festivalId = await createFestival(`Unlock ${suffix} ${endDate} ${timezone}`, "2026-01-01", endDate, timezone);
    const { data, error } = await admin.rpc("wrapped_unlocks_at", { p_festival_id: festivalId });
    expect(error).toBeNull();
    expect(new Date(data as string).toISOString()).toBe(expected);
  });
});

describe("gating and archive", () => {
  let user: Awaited<ReturnType<typeof createSignedInUser>>;
  let lockedFestivalId: string;
  let endedFestivalId: string;
  let notAttendedFestivalId: string;

  beforeAll(async () => {
    user = await createSignedInUser("gate");
    // Ends tomorrow, not today: "today" in UTC is already unlocked in Berlin after 22:00 UTC.
    lockedFestivalId = await createFestival(`Locked ${suffix} 2099`, isoDate(-3), isoDate(1));
    endedFestivalId = await createFestival(`Ended ${suffix} 2026`, isoDate(-10), isoDate(-2));
    notAttendedFestivalId = await createFestival(`Skipped ${suffix} 2026`, isoDate(-10), isoDate(-2));
    await attend(user.id, lockedFestivalId, isoDate(-1), 2);
    await attend(user.id, endedFestivalId, isoDate(-3), 3);
  });

  it("reports a locked festival as not unlocked, with attendance", async () => {
    const { data, error } = await user.client.rpc("get_wrapped_status", {
      p_festival_id: lockedFestivalId,
    });
    expect(error).toBeNull();
    expect(data?.[0]?.is_unlocked).toBe(false);
    expect(data?.[0]?.has_attendance).toBe(true);
  });

  it("refuses to compute a locked Wrapped and writes no cache row", async () => {
    const { error } = await user.client.rpc("get_wrapped_data_cached", {
      p_user_id: user.id,
      p_festival_id: lockedFestivalId,
    });
    expect(error?.message).toContain("WRAPPED_NOT_READY");
    expect(await cacheRow(user.id, lockedFestivalId)).toBeNull();
  });

  it("computes an unlocked Wrapped and stamps the current data version", async () => {
    const { data, error } = await user.client.rpc("get_wrapped_data_cached", {
      p_user_id: user.id,
      p_festival_id: endedFestivalId,
    });
    expect(error).toBeNull();
    expect((data as { basic_stats: { total_beers: number } }).basic_stats.total_beers).toBe(3);
    const { data: version } = await admin.rpc("wrapped_data_version");
    expect((await cacheRow(user.id, endedFestivalId))?.data_version).toBe(version);
  });

  it("treats a row with an old data version as a miss", async () => {
    await admin
      .from("wrapped_data_cache")
      .update({ wrapped_data: { stale: true }, data_version: 0 })
      .eq("user_id", user.id)
      .eq("festival_id", endedFestivalId);
    const { data, error } = await user.client.rpc("get_wrapped_data_cached", {
      p_user_id: user.id,
      p_festival_id: endedFestivalId,
    });
    expect(error).toBeNull();
    expect(data).toHaveProperty("basic_stats");
    expect(data).not.toHaveProperty("stale");
  });

  it("reports no attendance for a festival the user skipped", async () => {
    const { data } = await user.client.rpc("get_wrapped_status", {
      p_festival_id: notAttendedFestivalId,
    });
    expect(data?.[0]?.is_unlocked).toBe(true);
    expect(data?.[0]?.has_attendance).toBe(false);
  });

  it("lists only unlocked, attended festivals, newest first, with viewed flags", async () => {
    await admin.from("wrapped_views").insert({ user_id: user.id, festival_id: endedFestivalId });
    const { data, error } = await user.client.rpc("get_wrapped_festivals");
    expect(error).toBeNull();
    const ids = (data ?? []).map((row) => row.festival_id);
    expect(ids).toContain(endedFestivalId);
    expect(ids).not.toContain(lockedFestivalId);
    expect(ids).not.toContain(notAttendedFestivalId);
    expect(data?.find((row) => row.festival_id === endedFestivalId)?.viewed).toBe(true);
  });

  it("returns nothing to an anonymous caller", async () => {
    const { data } = await createTestSupabaseAnon().rpc("get_wrapped_festivals");
    expect(data ?? []).toHaveLength(0);
  });
});

async function linkTents(festivalId: string, count: number): Promise<string[]> {
  const { data: tents, error } = await admin.from("tents").select("id").limit(count);
  if (error || !tents || tents.length < count) {
    throw new Error(`need ${count} tents in the local seed: ${error?.message}`);
  }
  const { error: linkError } = await admin
    .from("festival_tents")
    .insert(tents.map((tent) => ({ festival_id: festivalId, tent_id: tent.id })));
  if (linkError) {
    throw new Error(`festival_tents insert failed: ${linkError.message}`);
  }
  return tents.map((tent) => tent.id);
}

describe("tent totals come from festival_tents", () => {
  it("computes diversity against the festival's own tent list", async () => {
    const user = await createSignedInUser("tents");
    const festivalId = await createFestival(`Tents ${suffix} 2026`, isoDate(-10), isoDate(-2));
    const tentIds = await linkTents(festivalId, 4);
    await attend(user.id, festivalId, isoDate(-3), 1);
    const { error: visitError } = await admin.from("tent_visits").insert({
      id: randomUUID(),
      user_id: user.id,
      festival_id: festivalId,
      tent_id: tentIds[0],
      visit_date: `${isoDate(-3)}T12:00:00Z`,
    });
    expect(visitError).toBeNull();

    const { data } = await user.client.rpc("get_wrapped_data_cached", {
      p_user_id: user.id,
      p_festival_id: festivalId,
    });
    // 1 of the festival's 4 tents, not 1 of every tent in the table
    expect((data as { tent_stats: { tent_diversity_pct: number } }).tent_stats.tent_diversity_pct).toBe(25);
  });

  it("returns 0 diversity for a festival with no tents", async () => {
    const user = await createSignedInUser("notents");
    const festivalId = await createFestival(`NoTents ${suffix} 2026`, isoDate(-10), isoDate(-2));
    await attend(user.id, festivalId, isoDate(-3), 1);
    const { data, error } = await user.client.rpc("get_wrapped_data_cached", {
      p_user_id: user.id,
      p_festival_id: festivalId,
    });
    expect(error).toBeNull();
    const wrapped = data as { tent_stats: { tent_diversity_pct: number }; personality: { type: string } };
    expect(wrapped.tent_stats.tent_diversity_pct).toBe(0);
    expect(wrapped.personality.type).not.toBe("Explorer");
    expect((wrapped.personality as unknown as { traits: string[] }).traits).toContain("Tent Loyalist");
  });
});

describe("previous festival matches Home progress", () => {
  it("picks the same previous festival as get_user_festival_progress", async () => {
    const user = await createSignedInUser("prev");
    const series = `Series ${suffix}`;
    const older = await createFestival(`${series} 2024`, "2024-09-21", "2024-10-06");
    const previous = await createFestival(`${series} 2025`, "2025-09-20", "2025-10-05");
    const current = await createFestival(`${series} 2026`, isoDate(-10), isoDate(-2));
    const otherSeries = await createFestival(`Other ${suffix} 2026`, "2026-03-01", "2026-03-10");
    await attend(user.id, older, "2024-09-22", 1);
    await attend(user.id, previous, "2025-09-21", 4);
    await attend(user.id, otherSeries, "2026-03-02", 9);
    await attend(user.id, current, isoDate(-3), 2);

    const { data: helperId } = await user.client.rpc("_previous_festival_in_series", {
      p_user_id: user.id,
      p_festival_id: current,
    });
    expect(helperId).toBe(previous);

    const { data: wrapped } = await user.client.rpc("get_wrapped_data_cached", {
      p_user_id: user.id,
      p_festival_id: current,
    });
    const vsLastYear = (wrapped as { comparisons: { vs_last_year: { prev_festival_name: string; prev_beers: number } } })
      .comparisons.vs_last_year;
    expect(vsLastYear.prev_festival_name).toBe(`${series} 2025`);
    expect(vsLastYear.prev_beers).toBe(4);

    const { data: progress } = await user.client.rpc("get_user_festival_progress", {
      p_festival_id: current,
      p_today: isoDate(-3),
    });
    expect(progress?.[0]?.previous_festival_name).toBe(`${series} 2025`);
  });
});

async function seedCacheRow(userId: string, festivalId: string) {
  const { error } = await admin
    .from("wrapped_data_cache")
    .upsert(
      { user_id: userId, festival_id: festivalId, wrapped_data: {}, data_version: 2 },
      { onConflict: "user_id,festival_id" },
    );
  if (error) {
    throw new Error(`cache seed failed: ${error.message}`);
  }
}

describe("cache invalidation", () => {
  let user: Awaited<ReturnType<typeof createSignedInUser>>;
  let festivalA: string;
  let festivalB: string;
  let attendanceA: string;
  let attendanceB: string;

  beforeAll(async () => {
    user = await createSignedInUser("inval");
    festivalA = await createFestival(`InvalA ${suffix} 2026`, isoDate(-10), isoDate(-2));
    festivalB = await createFestival(`InvalB ${suffix} 2026`, isoDate(-10), isoDate(-2));
    attendanceA = await attend(user.id, festivalA, isoDate(-3), 0);
    attendanceB = await attend(user.id, festivalB, isoDate(-3), 0);
  });

  it("drops the row when a consumption is inserted", async () => {
    await seedCacheRow(user.id, festivalA);
    await admin.from("consumptions").insert({
      attendance_id: attendanceA,
      drink_type: "beer",
      base_price_cents: 1500,
      price_paid_cents: 1500,
      recorded_at: `${isoDate(-3)}T12:00:00Z`,
    });
    expect(await cacheRow(user.id, festivalA)).toBeNull();
  });

  it("drops both festivals' rows when a consumption moves between them", async () => {
    const { data: drink } = await admin
      .from("consumptions")
      .select("id")
      .eq("attendance_id", attendanceA)
      .limit(1)
      .single();
    await seedCacheRow(user.id, festivalA);
    await seedCacheRow(user.id, festivalB);
    await admin.from("consumptions").update({ attendance_id: attendanceB }).eq("id", drink!.id);
    expect(await cacheRow(user.id, festivalA)).toBeNull();
    expect(await cacheRow(user.id, festivalB)).toBeNull();
  });

  it("drops the row when a consumption is deleted", async () => {
    await seedCacheRow(user.id, festivalB);
    await admin.from("consumptions").delete().eq("attendance_id", attendanceB);
    expect(await cacheRow(user.id, festivalB)).toBeNull();
  });

  it("drops all of a user's rows when their display name changes", async () => {
    await seedCacheRow(user.id, festivalA);
    await seedCacheRow(user.id, festivalB);
    await admin.from("profiles").update({ full_name: `Renamed ${suffix}` }).eq("id", user.id);
    expect(await cacheRow(user.id, festivalA)).toBeNull();
    expect(await cacheRow(user.id, festivalB)).toBeNull();
  });

  it("keeps rows when an unrelated profile column changes", async () => {
    await seedCacheRow(user.id, festivalA);
    await admin.from("profiles").update({ updated_at: new Date().toISOString() }).eq("id", user.id);
    expect(await cacheRow(user.id, festivalA)).not.toBeNull();
  });

  it("drops the row when the user joins a group of that festival", async () => {
    await seedCacheRow(user.id, festivalA);
    const { data: groupId, error } = await user.client.rpc("create_group_with_member", {
      p_group_name: `Grp ${suffix}`.slice(0, 40),
      p_user_id: user.id,
      p_festival_id: festivalA,
    });
    expect(error).toBeNull();
    expect(groupId).toBeTruthy();
    expect(await cacheRow(user.id, festivalA)).toBeNull();
  });
});

describe("admin regenerate", () => {
  it("seeds rows for attendees that had none, with the current version", async () => {
    const user = await createSignedInUser("regen");
    const festivalId = await createFestival(`Regen ${suffix} 2026`, isoDate(-10), isoDate(-2));
    await attend(user.id, festivalId, isoDate(-3), 2);
    expect(await cacheRow(user.id, festivalId)).toBeNull();

    // Service role has no JWT, which regenerate allows.
    const { data: count, error } = await admin.rpc("regenerate_wrapped_data_cache", {
      p_festival_id: festivalId,
    });
    expect(error).toBeNull();
    expect(count).toBe(1);
    const row = await cacheRow(user.id, festivalId);
    const { data: version } = await admin.rpc("wrapped_data_version");
    expect(row?.generated_by).toBe("admin");
    expect(row?.data_version).toBe(version);
  });

  it("skips festivals that have not unlocked", async () => {
    const user = await createSignedInUser("regenlocked");
    const festivalId = await createFestival(`RegenLocked ${suffix} 2099`, isoDate(-3), isoDate(1));
    await attend(user.id, festivalId, isoDate(-1), 1);
    const { data: count } = await admin.rpc("regenerate_wrapped_data_cache", {
      p_festival_id: festivalId,
    });
    expect(count).toBe(0);
  });
});
