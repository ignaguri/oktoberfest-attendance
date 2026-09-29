import { describe, expect, it, vi } from "vitest";

import type { WrappedOfficialStats } from "@prostcounter/shared";

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
