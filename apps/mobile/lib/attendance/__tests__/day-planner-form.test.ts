import { describe, expect, it } from "vitest";

import type { DayPlan } from "@prostcounter/shared/schemas";

import { buildPlannerDefaults, plannerFormSchema, toUpsertInput } from "../day-planner-form";

const SELECTED_DATE = new Date(2026, 8, 26);

function dayPlan(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    id: "p1",
    userId: "u1",
    festivalId: "f1",
    date: "2026-09-26",
    kind: "plan",
    tentId: null,
    tentName: null,
    note: null,
    visibleToGroups: true,
    startAt: null,
    endAt: null,
    status: null,
    reminderOffsetMinutes: null,
    autoCheckin: null,
    reminderSentAt: null,
    promptSentAt: null,
    processedAt: null,
    createdAt: "2026-09-16T10:00:00Z",
    updatedAt: null,
    ...overrides,
  };
}

describe("buildPlannerDefaults", () => {
  it("starts an empty day as a visible plan at noon", () => {
    expect(buildPlannerDefaults(null, SELECTED_DATE)).toEqual({
      status: "plan",
      tentId: "",
      startTime: new Date(2026, 8, 26, 12, 0),
      note: "",
      visibleToGroups: true,
      reminderOffsetMinutes: 30,
    });
  });

  it("loads a saved plan", () => {
    const values = buildPlannerDefaults(
      dayPlan({ tentId: "t1", note: "with the crew", visibleToGroups: false }),
      SELECTED_DATE,
    );

    expect(values).toMatchObject({
      status: "plan",
      tentId: "t1",
      note: "with the crew",
      visibleToGroups: false,
    });
  });

  it("loads a reservation's local arrival time and reminder", () => {
    const arrival = new Date(2026, 8, 26, 16, 30);
    const values = buildPlannerDefaults(
      dayPlan({
        kind: "reservation",
        tentId: "t1",
        startAt: arrival.toISOString(),
        status: "pending",
        reminderOffsetMinutes: 60,
      }),
      SELECTED_DATE,
    );

    expect(values.status).toBe("reservation");
    expect(values.startTime.getHours()).toBe(16);
    expect(values.startTime.getMinutes()).toBe(30);
    expect(values.reminderOffsetMinutes).toBe(60);
  });
});

describe("toUpsertInput", () => {
  const base = buildPlannerDefaults(null, SELECTED_DATE);

  it("returns null for not going", () => {
    expect(toUpsertInput({ ...base, status: "none" }, SELECTED_DATE)).toBeNull();
  });

  it("sends a plan with no tent as null and trims the note", () => {
    expect(toUpsertInput({ ...base, note: "  with the crew  " }, SELECTED_DATE)).toEqual({
      kind: "plan",
      tentId: null,
      note: "with the crew",
      visibleToGroups: true,
    });
  });

  it("sends a blank note as null", () => {
    expect(toUpsertInput({ ...base, note: "   " }, SELECTED_DATE)).toMatchObject({ note: null });
  });

  it("puts a reservation's time on the selected day", () => {
    const input = toUpsertInput(
      {
        ...base,
        status: "reservation",
        tentId: "t1",
        startTime: new Date(2026, 0, 1, 16, 30),
        reminderOffsetMinutes: 60,
      },
      SELECTED_DATE,
    );

    expect(input).toEqual({
      kind: "reservation",
      tentId: "t1",
      startAt: new Date(2026, 8, 26, 16, 30).toISOString(),
      note: null,
      visibleToGroups: true,
      reminderOffsetMinutes: 60,
    });
  });
});

describe("plannerFormSchema", () => {
  const base = buildPlannerDefaults(null, SELECTED_DATE);

  it("requires a tent only for a reservation", () => {
    expect(plannerFormSchema.safeParse({ ...base, status: "plan" }).success).toBe(true);
    expect(plannerFormSchema.safeParse({ ...base, status: "reservation" }).success).toBe(false);
    expect(
      plannerFormSchema.safeParse({ ...base, status: "reservation", tentId: "t1" }).success,
    ).toBe(true);
  });
});
