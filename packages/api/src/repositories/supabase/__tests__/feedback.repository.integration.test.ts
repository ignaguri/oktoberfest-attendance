// Integration test: requires a running local Supabase with the in_app_feedback migration applied.
// Run with: pnpm --filter=@prostcounter/api test:integration -- feedback.repository
import { randomUUID } from "crypto";
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createTestSupabaseAdmin,
  createTestSupabaseAnon,
  createTestSupabaseWithAuth,
} from "../../../__tests__/helpers/test-supabase";
import { SupabaseFeedbackRepository } from "../feedback.repository";

let admin: SupabaseClient<Database>;
let userId: string;
let userRepo: SupabaseFeedbackRepository;
let festivalId: string;

const DRINK_DAY = "2026-09-23";
const TENT_ONLY_DAY = "2026-09-22";

describe("SupabaseFeedbackRepository", () => {
  beforeAll(async () => {
    admin = createTestSupabaseAdmin();

    const anon = createTestSupabaseAnon();
    const email = `feedback-repo-${randomUUID()}@integration-test.com`;
    const password = "test-password-123!";
    const { data: signUp, error: signUpError } = await anon.auth.signUp({ email, password });
    if (signUpError || !signUp.user) {
      throw new Error(`signUp failed: ${signUpError?.message}`);
    }
    userId = signUp.user.id;
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInError || !signIn.session) {
      throw new Error(`signIn failed: ${signInError?.message}`);
    }
    userRepo = new SupabaseFeedbackRepository(createTestSupabaseWithAuth(signIn.session.access_token));

    const suffix = randomUUID();
    const { data: festival, error: festivalError } = await admin
      .from("festivals")
      .insert({
        name: `Feedback Repo Test ${suffix}`,
        short_name: `feedback-repo-${suffix}`.slice(0, 40),
        festival_type: "oktoberfest",
        start_date: "2026-09-19",
        end_date: "2026-10-04",
        beer_cost: 15.8,
        location: "Test Location",
        timezone: "Europe/Berlin",
        is_active: false,
        status: "ended",
      })
      .select()
      .single();
    if (festivalError || !festival) {
      throw new Error(`festival insert failed: ${festivalError?.message}`);
    }
    festivalId = festival.id;

    const { data: drinkDay, error: attendanceError } = await admin
      .from("attendances")
      .insert({ user_id: userId, festival_id: festivalId, date: DRINK_DAY })
      .select()
      .single();
    if (attendanceError || !drinkDay) {
      throw new Error(`attendance insert failed: ${attendanceError?.message}`);
    }
    const { error: consumptionError } = await admin
      .from("consumptions")
      .insert({ attendance_id: drinkDay.id, base_price_cents: 1580, price_paid_cents: 1580 });
    if (consumptionError) {
      throw new Error(`consumption insert failed: ${consumptionError.message}`);
    }

    // A day with an attendance but no drinks does not count as logged
    const { error: tentOnlyError } = await admin
      .from("attendances")
      .insert({ user_id: userId, festival_id: festivalId, date: TENT_ONLY_DAY });
    if (tentOnlyError) {
      throw new Error(`tent-only attendance insert failed: ${tentOnlyError.message}`);
    }
  });

  afterAll(async () => {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
    if (festivalId) {
      await admin.from("festivals").delete().eq("id", festivalId);
    }
  });

  it("lists only days with drinks, with the festival's name and clock", async () => {
    const days = await userRepo.listLoggedDaysSince(userId, "2026-09-20");
    expect(days).toEqual([
      {
        festivalId,
        festivalName: expect.stringContaining("Feedback Repo Test"),
        timezone: "Europe/Berlin",
        day: DRINK_DAY,
      },
    ]);
  });

  it("counts and checks logged days", async () => {
    expect(await userRepo.countLoggedDays(userId, festivalId)).toBe(1);
    expect(await userRepo.hasLoggedDay(userId, festivalId, DRINK_DAY)).toBe(true);
    expect(await userRepo.hasLoggedDay(userId, festivalId, TENT_ONLY_DAY)).toBe(false);
  });

  it("reports a second rating for the same day as a duplicate", async () => {
    const row = {
      userId,
      kind: "day" as const,
      rating: 4,
      message: null,
      festivalId,
      day: DRINK_DAY,
      platform: "ios",
      appVersion: "1.9.0",
      locale: "en",
    };
    const firstId = randomUUID();
    expect(await userRepo.insertFeedback({ id: firstId, ...row })).toBe("inserted");
    expect(await userRepo.insertFeedback({ id: randomUUID(), ...row })).toBe("duplicate");
    expect(await userRepo.findDayFeedbackId(userId, festivalId, DRINK_DAY)).toBe(firstId);
  });

  it("counts recent text submissions", async () => {
    await userRepo.insertFeedback({
      id: randomUUID(),
      userId,
      kind: "bug",
      rating: null,
      message: "Broken",
      festivalId: null,
      day: null,
      platform: null,
      appVersion: null,
      locale: null,
    });
    const since = new Date(Date.now() - 60_000).toISOString();
    expect(await userRepo.countSubmissionsSince(userId, ["bug", "idea"], since)).toBe(1);
  });

  it("keeps the first prompt outcome for a day", async () => {
    await userRepo.recordPrompt(userId, festivalId, DRINK_DAY, "dismissed");
    await userRepo.recordPrompt(userId, festivalId, DRINK_DAY, "answered");
    const prompts = await userRepo.listPrompts(userId);
    expect(prompts).toEqual([
      { festivalId, day: DRINK_DAY, outcome: "dismissed", createdAt: expect.any(String) },
    ]);
  });

  it("lists feedback for admins with the user and festival", async () => {
    const items = await new SupabaseFeedbackRepository(admin).listForAdmin({ kind: "day", limit: 50 });
    const ours = items.find((item) => item.user.id === userId);
    expect(ours).toMatchObject({
      kind: "day",
      rating: 4,
      festivalId,
      festivalName: expect.stringContaining("Feedback Repo Test"),
      day: DRINK_DAY,
      platform: "ios",
    });
  });
});
