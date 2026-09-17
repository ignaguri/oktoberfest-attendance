import { describe, expect, it } from "vitest";

import type { DayPlan } from "@prostcounter/shared/schemas";

import {
  buildPlannerDefaults,
  plannerFormSchema,
  resolveCompanionsInput,
  toUpsertInput,
} from "../day-planner-form";

const SELECTED_DATE = new Date(2026, 8, 26);
/**
 * The festival's timezone. UTC+14 all year, so it never matches the machine
 * running the tests: a result built on the device's clock would fail.
 */
const FESTIVAL_TIMEZONE = "Pacific/Kiritimati";

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
    companions: { users: [], groups: [] },
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
    expect(buildPlannerDefaults(null, SELECTED_DATE, FESTIVAL_TIMEZONE)).toEqual({
      status: "plan",
      tentId: "",
      startTime: new Date(2026, 8, 26, 12, 0),
      note: "",
      visibleToGroups: true,
      reminderOffsetMinutes: 30,
      companionUserIds: [],
      companionGroupIds: [],
    });
  });

  it("loads a saved plan", () => {
    const values = buildPlannerDefaults(
      dayPlan({ tentId: "t1", note: "with the crew", visibleToGroups: false }),
      SELECTED_DATE,
      FESTIVAL_TIMEZONE,
    );

    expect(values).toMatchObject({
      status: "plan",
      tentId: "t1",
      note: "with the crew",
      visibleToGroups: false,
    });
  });

  it("loads who a saved plan is going with", () => {
    const values = buildPlannerDefaults(
      dayPlan({
        companions: {
          users: [{ userId: "u2", username: "ana", fullName: null, avatarUrl: null }],
          groups: [{ groupId: "g1", name: "Office" }],
        },
      }),
      SELECTED_DATE,
      FESTIVAL_TIMEZONE,
    );

    expect(values.companionUserIds).toEqual(["u2"]);
    expect(values.companionGroupIds).toEqual(["g1"]);
  });

  it("loads a reservation's arrival time on the festival's clock, and its reminder", () => {
    const values = buildPlannerDefaults(
      dayPlan({
        kind: "reservation",
        tentId: "t1",
        // 16:30 in Kiritimati
        startAt: "2026-09-26T02:30:00.000Z",
        status: "pending",
        reminderOffsetMinutes: 60,
      }),
      SELECTED_DATE,
      FESTIVAL_TIMEZONE,
    );

    expect(values.status).toBe("reservation");
    expect(values.startTime.getHours()).toBe(16);
    expect(values.startTime.getMinutes()).toBe(30);
    expect(values.reminderOffsetMinutes).toBe(60);
  });
});

describe("toUpsertInput", () => {
  const base = buildPlannerDefaults(null, SELECTED_DATE, FESTIVAL_TIMEZONE);

  it("returns null for not going", () => {
    expect(toUpsertInput({ ...base, status: "none" }, SELECTED_DATE, FESTIVAL_TIMEZONE)).toBeNull();
  });

  it("sends a plan with no tent as null and trims the note", () => {
    expect(
      toUpsertInput({ ...base, note: "  with the crew  " }, SELECTED_DATE, FESTIVAL_TIMEZONE),
    ).toEqual({
      kind: "plan",
      tentId: null,
      note: "with the crew",
      visibleToGroups: true,
    });
  });

  it("sends a blank note as null", () => {
    expect(toUpsertInput({ ...base, note: "   " }, SELECTED_DATE, FESTIVAL_TIMEZONE)).toMatchObject(
      { note: null },
    );
  });

  it("books a reservation's time on the festival's clock, on the selected day", () => {
    const input = toUpsertInput(
      {
        ...base,
        status: "reservation",
        tentId: "t1",
        startTime: new Date(2026, 0, 1, 16, 30),
        reminderOffsetMinutes: 60,
      },
      SELECTED_DATE,
      FESTIVAL_TIMEZONE,
    );

    expect(input).toEqual({
      kind: "reservation",
      tentId: "t1",
      // 16:30 in Kiritimati, whatever the device's own timezone
      startAt: "2026-09-26T02:30:00.000Z",
      note: null,
      visibleToGroups: true,
      reminderOffsetMinutes: 60,
    });
  });
});

describe("toUpsertInput companions", () => {
  const base = buildPlannerDefaults(null, SELECTED_DATE, FESTIVAL_TIMEZONE);
  const companions = { userIds: ["u2"], groupIds: ["g1"] };

  it("carries companions on a plan and a reservation", () => {
    expect(toUpsertInput(base, SELECTED_DATE, FESTIVAL_TIMEZONE, companions)).toMatchObject({
      kind: "plan",
      companions,
    });
    expect(
      toUpsertInput(
        { ...base, status: "reservation", tentId: "t1" },
        SELECTED_DATE,
        FESTIVAL_TIMEZONE,
        companions,
      ),
    ).toMatchObject({ kind: "reservation", companions });
  });
});

describe("resolveCompanionsInput", () => {
  const values = { companionUserIds: ["u2", "gone"], companionGroupIds: ["g1", "left"] };
  const options = {
    users: [{ userId: "u2", username: "ana", fullName: null, avatarUrl: null }],
    groups: [{ groupId: "g1", name: "Office" }],
  };

  it("leaves the saved tags alone when the user didn't touch them", () => {
    expect(resolveCompanionsInput(values, false, options)).toBeUndefined();
  });

  it("drops anyone no longer on offer", () => {
    expect(resolveCompanionsInput(values, true, options)).toEqual({
      userIds: ["u2"],
      groupIds: ["g1"],
    });
  });

  it("sends the picks as they are when the options never loaded", () => {
    expect(resolveCompanionsInput(values, true, null)).toEqual({
      userIds: ["u2", "gone"],
      groupIds: ["g1", "left"],
    });
  });

  it("sends empty lists when the user cleared everyone", () => {
    expect(
      resolveCompanionsInput({ companionUserIds: [], companionGroupIds: [] }, true, options),
    ).toEqual({ userIds: [], groupIds: [] });
  });
});

describe("plannerFormSchema", () => {
  const base = buildPlannerDefaults(null, SELECTED_DATE, FESTIVAL_TIMEZONE);

  it("requires a tent only for a reservation", () => {
    expect(plannerFormSchema.safeParse({ ...base, status: "plan" }).success).toBe(true);
    expect(plannerFormSchema.safeParse({ ...base, status: "reservation" }).success).toBe(false);
    expect(
      plannerFormSchema.safeParse({ ...base, status: "reservation", tentId: "t1" }).success,
    ).toBe(true);
  });
});
