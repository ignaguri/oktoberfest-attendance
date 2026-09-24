import { describe, expect, it } from "vitest";

import type { LoggedDay, PromptRecord } from "../../repositories/interfaces/feedback.repository";
import { isPromptAllowed, pickCandidateDay, previousDay } from "../feedback-prompt-rule";

const OKTOBERFEST = "22222222-2222-4222-8222-222222222222";
const CANSTATT = "33333333-3333-4333-8333-333333333333";

function logged(day: string, overrides: Partial<LoggedDay> = {}): LoggedDay {
  return {
    festivalId: OKTOBERFEST,
    festivalName: "Oktoberfest 2026",
    timezone: "Europe/Berlin",
    day,
    ...overrides,
  };
}

function prompt(day: string, createdAt: string, overrides: Partial<PromptRecord> = {}): PromptRecord {
  return { festivalId: OKTOBERFEST, day, outcome: "dismissed", createdAt, ...overrides };
}

describe("previousDay", () => {
  it("steps back across a month boundary", () => {
    expect(previousDay("2026-10-01")).toBe("2026-09-30");
  });
});

describe("pickCandidateDay", () => {
  // Munich is UTC+2 in late September.
  it("offers yesterday once it is 07:00 at the festival", () => {
    const now = new Date("2026-09-24T05:00:00Z"); // 07:00 Munich
    expect(pickCandidateDay(now, [logged("2026-09-23")])).toEqual(logged("2026-09-23"));
  });

  it("waits until 07:00 so a late-night open does not count as the next day", () => {
    expect(pickCandidateDay(new Date("2026-09-23T22:30:00Z"), [logged("2026-09-23")])).toBeNull(); // 00:30
    expect(pickCandidateDay(new Date("2026-09-24T04:59:00Z"), [logged("2026-09-23")])).toBeNull(); // 06:59
  });

  it("ignores today and days before yesterday", () => {
    const now = new Date("2026-09-24T10:00:00Z");
    expect(pickCandidateDay(now, [logged("2026-09-24"), logged("2026-09-22")])).toBeNull();
  });

  it("uses each festival's own timezone", () => {
    // 07:30 in New York on Sep 24 is 11:30 UTC; Munich is already 13:30.
    const now = new Date("2026-09-24T11:30:00Z");
    const newYork = logged("2026-09-23", { timezone: "America/New_York" });
    expect(pickCandidateDay(now, [newYork])).toEqual(newYork);
    expect(pickCandidateDay(new Date("2026-09-24T10:30:00Z"), [newYork])).toBeNull(); // 06:30 NY
  });

  it("picks one festival deterministically when two logged yesterday", () => {
    const now = new Date("2026-09-24T08:00:00Z");
    const canstatt = logged("2026-09-23", { festivalId: CANSTATT, festivalName: "Wasen" });
    expect(pickCandidateDay(now, [canstatt, logged("2026-09-23")])?.festivalId).toBe(OKTOBERFEST);
  });
});

describe("isPromptAllowed", () => {
  const now = new Date("2026-09-24T08:00:00Z");
  const candidate = logged("2026-09-23");

  it("allows the first prompt of a festival", () => {
    expect(isPromptAllowed({ now, candidate, prompts: [], loggedDaysInFestival: 1 })).toBe(true);
  });

  it("never asks about the same day twice", () => {
    const prompts = [prompt("2026-09-23", "2026-09-20T08:00:00Z")];
    expect(isPromptAllowed({ now, candidate, prompts, loggedDaysInFestival: 5 })).toBe(false);
  });

  it("waits for 3 logged days before the second prompt", () => {
    const prompts = [prompt("2026-09-20", "2026-09-21T08:00:00Z")];
    expect(isPromptAllowed({ now, candidate, prompts, loggedDaysInFestival: 2 })).toBe(false);
    expect(isPromptAllowed({ now, candidate, prompts, loggedDaysInFestival: 3 })).toBe(true);
  });

  it("stops after two prompts in a festival", () => {
    const prompts = [
      prompt("2026-09-19", "2026-09-20T08:00:00Z"),
      prompt("2026-09-20", "2026-09-21T08:00:00Z"),
    ];
    expect(isPromptAllowed({ now, candidate, prompts, loggedDaysInFestival: 6 })).toBe(false);
  });

  it("keeps 48 hours between prompts, across festivals", () => {
    const recent = [prompt("2026-09-22", "2026-09-22T09:00:00Z", { festivalId: CANSTATT })];
    expect(isPromptAllowed({ now, candidate, prompts: recent, loggedDaysInFestival: 1 })).toBe(false);
    const older = [prompt("2026-09-21", "2026-09-22T07:59:00Z", { festivalId: CANSTATT })];
    expect(isPromptAllowed({ now, candidate, prompts: older, loggedDaysInFestival: 1 })).toBe(true);
  });
});
