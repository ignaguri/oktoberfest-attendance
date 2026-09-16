import type { DayPlan, UpsertDayPlanInput } from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { describe, expect, it, vi } from "vitest";

import type {
  DayPlanWrite,
  FestivalDayContext,
  IDayPlanRepository,
} from "../../repositories/interfaces";
import { buildWrite, DayPlanService } from "../day-plan.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const FESTIVAL_ID = "22222222-2222-4222-8222-222222222222";
const TENT_ID = "33333333-3333-4333-8333-333333333333";
const PLAN_ID = "44444444-4444-4444-8444-444444444444";
/** 12:00 in Munich on Sunday Sep 20. */
const NOW = new Date("2026-09-20T10:00:00Z");
const FESTIVAL: FestivalDayContext = {
  id: FESTIVAL_ID,
  timezone: "Europe/Berlin",
  startDate: "2026-09-19",
  endDate: "2026-10-04",
};

function dayPlan(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    id: PLAN_ID,
    userId: USER_ID,
    festivalId: FESTIVAL_ID,
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

function createRepo(existing: DayPlan | null = null) {
  return {
    getFestivalContext: vi.fn().mockResolvedValue(FESTIVAL),
    listActive: vi.fn().mockResolvedValue([]),
    findActiveByDate: vi.fn().mockResolvedValue(existing),
    insert: vi.fn(async (_userId: string, _festivalId: string, date: string, write: DayPlanWrite) =>
      dayPlan({ ...write, date }),
    ),
    update: vi.fn(async (id: string, _userId: string, write: DayPlanWrite) =>
      dayPlan({ ...existing, ...write, id }),
    ),
    deleteById: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(async (id: string) => dayPlan({ ...existing, id, status: "cancelled" })),
    listFriendsGoing: vi.fn().mockResolvedValue([]),
  };
}

function createService(repo: ReturnType<typeof createRepo>, now: Date = NOW) {
  return new DayPlanService(repo as unknown as IDayPlanRepository, () => now);
}

const PLAN_INPUT: UpsertDayPlanInput = {
  kind: "plan",
  visibleToGroups: true,
  note: "with the crew",
};

function reservationInput(
  overrides: Partial<Extract<UpsertDayPlanInput, { kind: "reservation" }>> = {},
) {
  return {
    kind: "reservation",
    tentId: TENT_ID,
    startAt: "2026-09-26T14:00:00.000Z",
    visibleToGroups: true,
    ...overrides,
  } satisfies UpsertDayPlanInput;
}

describe("DayPlanService.upsertPlan", () => {
  it("creates a plan on an empty day and reports it as newly visible", async () => {
    const repo = createRepo();

    const result = await createService(repo).upsertPlan(
      USER_ID,
      FESTIVAL_ID,
      "2026-09-26",
      PLAN_INPUT,
    );

    expect(repo.insert).toHaveBeenCalledWith(
      USER_ID,
      FESTIVAL_ID,
      "2026-09-26",
      expect.objectContaining({ kind: "plan", note: "with the crew", status: null }),
    );
    expect(result).toMatchObject({ becameVisible: true, today: "2026-09-20" });
  });

  it("accepts today", async () => {
    const repo = createRepo();

    await expect(
      createService(repo).upsertPlan(USER_ID, FESTIVAL_ID, "2026-09-20", PLAN_INPUT),
    ).resolves.toBeDefined();
  });

  it("rejects a day outside the festival", async () => {
    await expect(
      createService(createRepo()).upsertPlan(USER_ID, FESTIVAL_ID, "2026-10-05", PLAN_INPUT),
    ).rejects.toMatchObject({ code: ErrorCodes.DATE_OUTSIDE_FESTIVAL });
  });

  it("rejects a day that has passed", async () => {
    await expect(
      createService(createRepo()).upsertPlan(USER_ID, FESTIVAL_ID, "2026-09-19", PLAN_INPUT),
    ).rejects.toMatchObject({ code: ErrorCodes.DAY_PLAN_DATE_IN_PAST });
  });

  it("rejects an unknown festival", async () => {
    const repo = createRepo();
    repo.getFestivalContext.mockResolvedValueOnce(null);

    await expect(
      createService(repo).upsertPlan(USER_ID, FESTIVAL_ID, "2026-09-26", PLAN_INPUT),
    ).rejects.toMatchObject({ code: ErrorCodes.FESTIVAL_NOT_FOUND });
  });

  it("upgrades an existing plan to a reservation on the same row", async () => {
    const repo = createRepo(dayPlan());

    const result = await createService(repo).upsertPlan(
      USER_ID,
      FESTIVAL_ID,
      "2026-09-26",
      reservationInput(),
    );

    expect(repo.insert).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(
      PLAN_ID,
      USER_ID,
      expect.objectContaining({
        kind: "reservation",
        status: "pending",
        reminderOffsetMinutes: 30,
        autoCheckin: false,
      }),
    );
    expect(result.becameVisible).toBe(false);
  });

  it("reports a day as newly visible when visibility is switched on", async () => {
    const repo = createRepo(dayPlan({ visibleToGroups: false }));

    const result = await createService(repo).upsertPlan(
      USER_ID,
      FESTIVAL_ID,
      "2026-09-26",
      PLAN_INPUT,
    );

    expect(result.becameVisible).toBe(true);
  });

  it("rejects a reservation whose start time has passed", async () => {
    await expect(
      createService(createRepo()).upsertPlan(
        USER_ID,
        FESTIVAL_ID,
        "2026-09-20",
        reservationInput({ startAt: "2026-09-20T09:00:00.000Z" }),
      ),
    ).rejects.toMatchObject({ code: ErrorCodes.RESERVATION_START_IN_PAST });
  });

  it("rejects a reservation whose start time falls on another day", async () => {
    // 23:30 UTC is 01:30 on Sep 27 in Munich.
    await expect(
      createService(createRepo()).upsertPlan(
        USER_ID,
        FESTIVAL_ID,
        "2026-09-26",
        reservationInput({ startAt: "2026-09-26T23:30:00.000Z" }),
      ),
    ).rejects.toMatchObject({ code: ErrorCodes.DAY_PLAN_DATE_MISMATCH });
  });

  it("refuses to change a reservation that was already checked in", async () => {
    const repo = createRepo(
      dayPlan({ kind: "reservation", status: "checked_in", tentId: TENT_ID }),
    );

    await expect(
      createService(repo).upsertPlan(USER_ID, FESTIVAL_ID, "2026-09-26", PLAN_INPUT),
    ).rejects.toMatchObject({ code: ErrorCodes.DAY_PLAN_CONFLICT });
  });
});

describe("buildWrite", () => {
  it("clears every reservation field for a plan", () => {
    const existing = dayPlan({
      kind: "reservation",
      status: "pending",
      startAt: "2026-09-26T14:00:00.000Z",
      reminderOffsetMinutes: 60,
      autoCheckin: true,
    });

    expect(buildWrite(PLAN_INPUT, existing)).toEqual({
      kind: "plan",
      tentId: null,
      note: "with the crew",
      visibleToGroups: true,
      startAt: null,
      endAt: null,
      status: null,
      reminderOffsetMinutes: null,
      autoCheckin: null,
    });
  });

  it("keeps an existing reservation's status and reminder settings when editing it", () => {
    const existing = dayPlan({
      kind: "reservation",
      status: "confirmed",
      reminderOffsetMinutes: 60,
      autoCheckin: true,
      endAt: "2026-09-26T18:00:00.000Z",
    });

    expect(buildWrite(reservationInput(), existing)).toMatchObject({
      status: "confirmed",
      reminderOffsetMinutes: 60,
      autoCheckin: true,
      endAt: "2026-09-26T18:00:00.000Z",
    });
  });
});

describe("DayPlanService.removePlan", () => {
  it("deletes a plan", async () => {
    const repo = createRepo(dayPlan());

    await createService(repo).removePlan(USER_ID, FESTIVAL_ID, "2026-09-26");

    expect(repo.deleteById).toHaveBeenCalledWith(PLAN_ID, USER_ID);
    expect(repo.cancel).not.toHaveBeenCalled();
  });

  it("cancels a reservation instead of deleting it", async () => {
    const repo = createRepo(dayPlan({ kind: "reservation", status: "pending", tentId: TENT_ID }));

    await createService(repo).removePlan(USER_ID, FESTIVAL_ID, "2026-09-26");

    expect(repo.cancel).toHaveBeenCalledWith(PLAN_ID, USER_ID);
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it("refuses to cancel a reservation that already happened", async () => {
    const repo = createRepo(dayPlan({ kind: "reservation", status: "checked_in", tentId: TENT_ID }));

    await expect(
      createService(repo).removePlan(USER_ID, FESTIVAL_ID, "2026-09-26"),
    ).rejects.toMatchObject({ code: ErrorCodes.DAY_PLAN_CONFLICT });
    expect(repo.cancel).not.toHaveBeenCalled();
  });

  it("fails when the day has no mark", async () => {
    await expect(
      createService(createRepo()).removePlan(USER_ID, FESTIVAL_ID, "2026-09-26"),
    ).rejects.toMatchObject({ code: ErrorCodes.DAY_PLAN_NOT_FOUND });
  });
});

describe("DayPlanService.getFriendsGoing", () => {
  it("asks for days from today in the festival's timezone", async () => {
    const repo = createRepo();
    // 22:30 UTC on Sep 20 is already Sep 21 in Munich.
    const lateNight = new Date("2026-09-20T22:30:00Z");

    await createService(repo, lateNight).getFriendsGoing(USER_ID, FESTIVAL_ID);

    expect(repo.listFriendsGoing).toHaveBeenCalledWith(USER_ID, FESTIVAL_ID, "2026-09-21");
  });
});
