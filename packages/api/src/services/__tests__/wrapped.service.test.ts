import { describe, expect, it, vi } from "vitest";

import type { WrappedData, WrappedFestival, WrappedOfficialStats } from "@prostcounter/shared";
import { derivePersona } from "@prostcounter/shared/wrapped/server";
import { makeWrapped } from "@prostcounter/shared/wrapped/testing";

import type { IWrappedRepository } from "../../repositories/interfaces";
import { WrappedService } from "../wrapped.service";

function repo(overrides: Partial<IWrappedRepository>): IWrappedRepository {
  return {
    getStatus: vi.fn(),
    getWrapped: vi.fn(),
    listFestivals: vi.fn(),
    markViewed: vi.fn(),
    invalidateCache: vi.fn(),
    regenerateCache: vi.fn(),
    isAdmin: vi.fn(),
    listOpenedPersonas: vi.fn().mockResolvedValue([]),
    markPersonaOpened: vi.fn(),
    ...overrides,
  } as IWrappedRepository;
}

function statsRepo(result: WrappedOfficialStats | null | Error = null) {
  return {
    getForWrapped: vi.fn(() =>
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
    ),
  };
}

const officialStats: WrappedOfficialStats = {
  year: 2025,
  isCurrentFestival: false,
  visitors: 6500000,
  massServed: 6500000,
  mugsConfiscated: 116000,
  lostItems: 4500,
  curiousFinds: [{ de: "ein Akkordeon", en: "an accordion", es: "un acordeón" }],
  sourceUrl: "https://www.muenchen.de/x",
};

describe("WrappedService.getWrapped", () => {
  it("returns locked without computing or marking viewed", async () => {
    const wrappedRepo = repo({
      getStatus: vi.fn().mockResolvedValue({ unlocksAt: "2026-10-04T22:00:00.000Z", isUnlocked: false, hasAttendance: true }),
    });
    const { result } = await new WrappedService(wrappedRepo, statsRepo()).getWrapped("u", "f");
    expect(result).toEqual({ status: "locked", unlocksAt: "2026-10-04T22:00:00.000Z" });
    expect(wrappedRepo.getWrapped).not.toHaveBeenCalled();
    expect(wrappedRepo.markViewed).not.toHaveBeenCalled();
  });

  it("returns not_attended for an unknown festival or no attendance", async () => {
    const unknown = repo({ getStatus: vi.fn().mockResolvedValue(null) });
    expect((await new WrappedService(unknown, statsRepo()).getWrapped("u", "f")).result).toEqual({ status: "not_attended" });
    const skipped = repo({
      getStatus: vi.fn().mockResolvedValue({ unlocksAt: "x", isUnlocked: true, hasAttendance: false }),
    });
    expect((await new WrappedService(skipped, statsRepo()).getWrapped("u", "f")).result).toEqual({ status: "not_attended" });
  });

  it("returns ready and marks viewed", async () => {
    const wrapped = { basicStats: { totalBeers: 1 } };
    const wrappedRepo = repo({
      getStatus: vi.fn().mockResolvedValue({ unlocksAt: "2020-10-04T22:00:00.000Z", isUnlocked: true, hasAttendance: true }),
      getWrapped: vi.fn().mockResolvedValue(wrapped),
    });
    const { result, viewRecorded } = await new WrappedService(wrappedRepo, statsRepo()).getWrapped("u", "f");
    expect(result).toEqual({ status: "ready", wrapped, officialStats: null });
    expect(viewRecorded).toBe(true);
    expect(wrappedRepo.markViewed).toHaveBeenCalledWith("u", "f");
  });

  // A super admin sees a locked festival as unlocked. That preview must not
  // count as the view: it would unlock wrapped_viewed early and hide the
  // archive's "New" pill once the festival really unlocks.
  it("serves a super-admin preview without recording a view", async () => {
    const wrapped = { basicStats: { totalBeers: 1 } };
    const wrappedRepo = repo({
      getStatus: vi.fn().mockResolvedValue({ unlocksAt: "2999-10-04T22:00:00.000Z", isUnlocked: true, hasAttendance: true }),
      getWrapped: vi.fn().mockResolvedValue(wrapped),
    });
    const { result, viewRecorded } = await new WrappedService(wrappedRepo, statsRepo()).getWrapped("u", "f");
    expect(result).toEqual({ status: "ready", wrapped, officialStats: null });
    expect(viewRecorded).toBe(false);
    expect(wrappedRepo.markViewed).not.toHaveBeenCalled();
  });

  it("returns the official stats next to a ready Wrapped", async () => {
    const wrappedRepo = repo({
      getStatus: vi.fn().mockResolvedValue({ unlocksAt: "2020-10-04T22:00:00.000Z", isUnlocked: true, hasAttendance: true }),
      getWrapped: vi.fn().mockResolvedValue({ basicStats: { totalBeers: 1 } }),
    });
    const stats = statsRepo(officialStats);
    const { result } = await new WrappedService(wrappedRepo, stats).getWrapped("u", "f");
    expect(result).toMatchObject({ status: "ready", officialStats });
    expect(stats.getForWrapped).toHaveBeenCalledWith("f");
  });

  it("serves the Wrapped without official stats when reading them fails", async () => {
    const wrappedRepo = repo({
      getStatus: vi.fn().mockResolvedValue({ unlocksAt: "2020-10-04T22:00:00.000Z", isUnlocked: true, hasAttendance: true }),
      getWrapped: vi.fn().mockResolvedValue({ basicStats: { totalBeers: 1 } }),
    });
    const { result } = await new WrappedService(wrappedRepo, statsRepo(new Error("boom"))).getWrapped("u", "f");
    expect(result).toMatchObject({ status: "ready", officialStats: null });
  });

  it("does not read official stats for a locked festival", async () => {
    const wrappedRepo = repo({
      getStatus: vi.fn().mockResolvedValue({ unlocksAt: "2999-10-04T22:00:00.000Z", isUnlocked: false, hasAttendance: true }),
    });
    const stats = statsRepo(officialStats);
    await new WrappedService(wrappedRepo, stats).getWrapped("u", "f");
    expect(stats.getForWrapped).not.toHaveBeenCalled();
  });
});

describe("WrappedService.checkAccessLegacy", () => {
  it.each([
    [null, { allowed: false, reason: "error" }],
    [{ unlocksAt: "x", isUnlocked: false, hasAttendance: true }, { allowed: false, reason: "not_ended" }],
    [{ unlocksAt: "x", isUnlocked: true, hasAttendance: false }, { allowed: false, reason: "no_data" }],
    [{ unlocksAt: "x", isUnlocked: true, hasAttendance: true }, { allowed: true }],
  ])("maps %o", async (status, expected) => {
    const wrappedRepo = repo({ getStatus: vi.fn().mockResolvedValue(status) });
    expect(await new WrappedService(wrappedRepo, statsRepo()).checkAccessLegacy("f")).toEqual(expected);
  });
});

/** Qualifies for no rule, so Der Genießer (same shape as persona.test.ts). */
function neutral(mutate?: (data: WrappedData) => void): WrappedData {
  return makeWrapped((data) => {
    data.basicStats.daysAttended = 3;
    data.basicStats.totalBeers = 6;
    data.basicStats.avgBeers = 2;
    data.tentStats.uniqueTents = 2;
    data.tentStats.tentDiversityPct = 10;
    data.tentStats.tentBreakdown = [
      { tentName: "Schottenhamel", visitCount: 2 },
      { tentName: "Hacker-Festzelt", visitCount: 2 },
    ];
    data.drinkStats.totalDrinks = 6;
    data.drinkStats.breakdown = [{ drinkType: "beer", count: 6, percentage: 100 }];
    data.timing = { timedDays: 3, medianFirstHour: 14, medianLastHour: 20, peakHour: 17, weekendShare: 0.33 };
    mutate?.(data);
  });
}

const nightOwl = () =>
  neutral((data) => {
    data.timing.medianLastHour = 23;
  });

/** makeWrapped defaults to an Oktoberfest */
const atFruehlingsfest = (data: WrappedData): WrappedData => {
  data.festivalInfo.festivalType = "fruehlingsfest";
  return data;
};

function festival(festivalId: string, name: string): WrappedFestival {
  return { festivalId, name, startDate: "2026-09-19", endDate: "2026-10-04", unlocksAt: "2026-10-04T22:00:00.000Z", viewed: true };
}

const okt26 = festival("11111111-1111-4111-8111-111111111111", "Oktoberfest 2026");
const fruehling26 = festival("22222222-2222-4222-8222-222222222222", "Frühlingsfest 2026");
const okt25 = festival("33333333-3333-4333-8333-333333333333", "Oktoberfest 2025");

describe("WrappedService.getPersonaCollection", () => {
  it("fixtures derive the personas the tests rely on", () => {
    expect(derivePersona(neutral()).id).toBe("geniesser");
    expect(derivePersona(nightOwl()).id).toBe("nachteule");
  });

  it("groups festivals by persona in PERSONA_IDS order, newest first, with opened flags", async () => {
    const byFestival: Record<string, WrappedData> = {
      [okt26.festivalId]: nightOwl(),
      [fruehling26.festivalId]: atFruehlingsfest(neutral()),
      [okt25.festivalId]: nightOwl(),
    };
    const wrappedRepo = repo({
      listFestivals: vi.fn().mockResolvedValue([okt26, fruehling26, okt25]),
      getWrapped: vi.fn((_userId: string, festivalId: string) => Promise.resolve(byFestival[festivalId])),
      listOpenedPersonas: vi.fn().mockResolvedValue(["nachteule"]),
    });

    const result = await new WrappedService(wrappedRepo, statsRepo()).getPersonaCollection("u");

    expect(result).toEqual({
      earned: [
        {
          personaId: "nachteule",
          festivals: [
            { festivalId: okt26.festivalId, name: "Oktoberfest 2026", isWiesn: true },
            { festivalId: okt25.festivalId, name: "Oktoberfest 2025", isWiesn: true },
          ],
          opened: true,
        },
        {
          personaId: "geniesser",
          festivals: [{ festivalId: fruehling26.festivalId, name: "Frühlingsfest 2026", isWiesn: false }],
          opened: false,
        },
      ],
    });
    expect(wrappedRepo.getWrapped).toHaveBeenCalledWith("u", okt26.festivalId);
    expect(wrappedRepo.listOpenedPersonas).toHaveBeenCalledWith("u");
  });

  it("skips a festival whose Wrapped fails to load and returns the rest", async () => {
    const wrappedRepo = repo({
      listFestivals: vi.fn().mockResolvedValue([okt26, fruehling26]),
      getWrapped: vi.fn((_userId: string, festivalId: string) =>
        festivalId === okt26.festivalId ? Promise.reject(new Error("rpc down")) : Promise.resolve(atFruehlingsfest(neutral())),
      ),
    });

    const result = await new WrappedService(wrappedRepo, statsRepo()).getPersonaCollection("u");

    expect(result.earned).toEqual([
      {
        personaId: "geniesser",
        festivals: [{ festivalId: fruehling26.festivalId, name: "Frühlingsfest 2026", isWiesn: false }],
        opened: false,
      },
    ]);
  });

  it("never records a Wrapped view", async () => {
    const wrappedRepo = repo({
      listFestivals: vi.fn().mockResolvedValue([okt26]),
      getWrapped: vi.fn().mockResolvedValue(neutral()),
    });
    await new WrappedService(wrappedRepo, statsRepo()).getPersonaCollection("u");
    expect(wrappedRepo.markViewed).not.toHaveBeenCalled();
  });

  it("returns nothing earned when the user has no unlocked Wrapped", async () => {
    const wrappedRepo = repo({ listFestivals: vi.fn().mockResolvedValue([]) });
    const result = await new WrappedService(wrappedRepo, statsRepo()).getPersonaCollection("u");
    expect(result).toEqual({ earned: [] });
  });
});

describe("WrappedService.openPersonaCard", () => {
  it("records the open", async () => {
    const wrappedRepo = repo({ markPersonaOpened: vi.fn().mockResolvedValue(undefined) });
    await new WrappedService(wrappedRepo, statsRepo()).openPersonaCard("u", "nachteule");
    expect(wrappedRepo.markPersonaOpened).toHaveBeenCalledWith("u", "nachteule");
  });
});
