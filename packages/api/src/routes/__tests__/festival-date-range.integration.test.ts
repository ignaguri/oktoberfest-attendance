// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test:integration -- festival-date-range
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ErrorCodes } from "@prostcounter/shared/errors";

import { createTestUser, type TestUser } from "../../__tests__/helpers/day-plan-fixtures";
import { deleteTestUsersAndFestivals } from "../../__tests__/helpers/test-cleanup";
import { createTestSupabaseAdmin } from "../../__tests__/helpers/test-supabase";
import { createTestApp } from "../../__tests__/helpers/test-server";
import { authMiddleware } from "../../middleware/auth";
import attendanceRoutes from "../attendance.route";
import consumptionRoutes from "../consumption.route";

const admin = createTestSupabaseAdmin();
const app = createTestApp();
app.use("*", authMiddleware);
app.route("/", attendanceRoutes);
app.route("/", consumptionRoutes);

let user: TestUser;
let festivalId: string;

beforeAll(async () => {
  user = await createTestUser("date-range");
  const suffix = randomUUID().slice(0, 12);
  const { data, error } = await admin
    .from("festivals")
    .insert({
      name: `Date Range Test Festival ${suffix}`,
      short_name: `dr-${suffix}`,
      festival_type: "oktoberfest",
      start_date: "2024-09-21",
      end_date: "2024-10-06",
      beer_cost: 16.2,
      location: "Test Location",
      timezone: "Europe/Berlin",
      is_active: false,
      status: "ended",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create festival: ${error?.message}`);
  }
  festivalId = data.id;
});

afterAll(async () => {
  await deleteTestUsersAndFestivals(admin, {
    userIds: user ? [user.id] : [],
    festivalIds: festivalId ? [festivalId] : [],
  });
});

function post(path: string, body: Record<string, unknown>) {
  return app.request(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ festivalId, ...body }),
  });
}

describe("writes outside a festival's dates", () => {
  it.each([
    ["/consumption", { date: "2024-10-07" }],
    ["/attendance", { date: "2024-10-07" }],
    ["/attendance/personal", { date: "2024-09-20", tents: [] }],
    ["/attendance/tent-visits", { tentId: randomUUID(), visitedAt: "2024-10-06T22:30:00Z" }],
  ])("%s is rejected", async (path, body) => {
    const response = await post(path, body);

    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe(ErrorCodes.DATE_OUTSIDE_FESTIVAL);
  });

  it("still accepts a backfilled day after the festival ended", async () => {
    const response = await post("/consumption", { date: "2024-10-06" });

    expect(response.status).toBe(200);
  });
});
