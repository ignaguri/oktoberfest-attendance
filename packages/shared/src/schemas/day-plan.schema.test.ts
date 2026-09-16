import { describe, expect, it } from "vitest";

import { DAY_PLAN_NOTE_MAX_LENGTH, DayPlanPathParamsSchema, UpsertDayPlanSchema } from "./day-plan.schema";

const TENT_ID = "33333333-3333-4333-8333-333333333333";

describe("UpsertDayPlanSchema", () => {
  it("accepts a plan with only its visibility", () => {
    expect(UpsertDayPlanSchema.safeParse({ kind: "plan", visibleToGroups: true }).success).toBe(true);
  });

  it("accepts a plan with a tent and a note", () => {
    const result = UpsertDayPlanSchema.safeParse({
      kind: "plan",
      tentId: TENT_ID,
      note: "with the office crew",
      visibleToGroups: false,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a reservation without a tent", () => {
    const result = UpsertDayPlanSchema.safeParse({
      kind: "reservation",
      startAt: "2026-09-26T14:00:00.000Z",
      visibleToGroups: true,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a reservation without a start time", () => {
    const result = UpsertDayPlanSchema.safeParse({
      kind: "reservation",
      tentId: TENT_ID,
      visibleToGroups: true,
    });

    expect(result.success).toBe(false);
  });

  it("caps the note at 200 characters", () => {
    const base = { kind: "plan", visibleToGroups: true } as const;

    expect(DAY_PLAN_NOTE_MAX_LENGTH).toBe(200);
    expect(UpsertDayPlanSchema.safeParse({ ...base, note: "a".repeat(200) }).success).toBe(true);
    expect(UpsertDayPlanSchema.safeParse({ ...base, note: "a".repeat(201) }).success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    expect(UpsertDayPlanSchema.safeParse({ kind: "maybe", visibleToGroups: true }).success).toBe(false);
  });
});

describe("DayPlanPathParamsSchema", () => {
  it("requires an ISO date", () => {
    const festivalId = "22222222-2222-4222-8222-222222222222";

    expect(DayPlanPathParamsSchema.safeParse({ festivalId, date: "2026-09-26" }).success).toBe(true);
    expect(DayPlanPathParamsSchema.safeParse({ festivalId, date: "26-09-2026" }).success).toBe(false);
  });
});
