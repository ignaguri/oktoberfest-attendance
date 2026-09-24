import { ErrorCodes } from "@prostcounter/shared/errors";
import { describe, expect, it, vi } from "vitest";

import type { FeedbackNotifier } from "../../lib/feedback-email";
import type {
  FeedbackInsert,
  IFeedbackRepository,
  LoggedDay,
  PromptRecord,
} from "../../repositories/interfaces";
import { FeedbackService } from "../feedback.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const FESTIVAL_ID = "22222222-2222-4222-8222-222222222222";
const NEW_ID = "44444444-4444-4444-8444-444444444444";
/** 10:00 in Munich on Thursday Sep 24. */
const NOW = new Date("2026-09-24T08:00:00Z");

const YESTERDAY: LoggedDay = {
  festivalId: FESTIVAL_ID,
  festivalName: "Oktoberfest 2026",
  timezone: "Europe/Berlin",
  day: "2026-09-23",
};

function fakeRepo(overrides: Partial<IFeedbackRepository> = {}): IFeedbackRepository {
  return {
    listLoggedDaysSince: vi.fn().mockResolvedValue([YESTERDAY]),
    countLoggedDays: vi.fn().mockResolvedValue(1),
    hasLoggedDay: vi.fn().mockResolvedValue(true),
    listPrompts: vi.fn().mockResolvedValue([] as PromptRecord[]),
    recordPrompt: vi.fn().mockResolvedValue(undefined),
    insertFeedback: vi.fn().mockResolvedValue("inserted"),
    findDayFeedbackId: vi.fn().mockResolvedValue(null),
    getSubmitter: vi.fn().mockResolvedValue({ username: "sepp", preferredLanguage: "de" }),
    getFestivalName: vi.fn().mockResolvedValue("Oktoberfest 2026"),
    listForAdmin: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function fakeNotifier(): FeedbackNotifier & { notify: ReturnType<typeof vi.fn> } {
  return { notify: vi.fn().mockResolvedValue(undefined) };
}

const CONTEXT = { userId: USER_ID, userEmail: "sepp@example.com", platform: "ios", appVersion: "1.9.0" };

function service(repo: IFeedbackRepository, notifier = fakeNotifier()) {
  return new FeedbackService(repo, notifier, () => NOW, () => NEW_ID);
}

describe("FeedbackService.getDayPrompt", () => {
  it("offers yesterday when nothing blocks it", async () => {
    const repo = fakeRepo();
    expect(await service(repo).getDayPrompt(USER_ID)).toEqual({
      festivalId: FESTIVAL_ID,
      festivalName: "Oktoberfest 2026",
      day: "2026-09-23",
    });
    expect(repo.listLoggedDaysSince).toHaveBeenCalledWith(USER_ID, "2026-09-21");
  });

  it("returns null without a logged day yesterday, and skips the other reads", async () => {
    const repo = fakeRepo({ listLoggedDaysSince: vi.fn().mockResolvedValue([]) });
    expect(await service(repo).getDayPrompt(USER_ID)).toBeNull();
    expect(repo.listPrompts).not.toHaveBeenCalled();
  });

  it("returns null when the caps say no", async () => {
    const repo = fakeRepo({
      listPrompts: vi.fn().mockResolvedValue([
        { festivalId: FESTIVAL_ID, day: "2026-09-23", outcome: "dismissed", createdAt: "2026-09-20T08:00:00Z" },
      ]),
    });
    expect(await service(repo).getDayPrompt(USER_ID)).toBeNull();
  });
});

describe("FeedbackService.dismissDayPrompt", () => {
  it("records a dismissal", async () => {
    const repo = fakeRepo();
    await service(repo).dismissDayPrompt(USER_ID, FESTIVAL_ID, "2026-09-23");
    expect(repo.recordPrompt).toHaveBeenCalledWith(USER_ID, FESTIVAL_ID, "2026-09-23", "dismissed");
  });
});

describe("FeedbackService.submit", () => {
  it("stores a day rating, marks the prompt answered, and emails when there is text", async () => {
    const repo = fakeRepo();
    const notifier = fakeNotifier();
    const result = await service(repo, notifier).submit(CONTEXT, {
      kind: "day",
      rating: 4,
      message: "  The map was slow  ",
      festivalId: FESTIVAL_ID,
      day: "2026-09-23",
    });

    expect(result).toEqual({ id: NEW_ID });
    const row = vi.mocked(repo.insertFeedback).mock.calls[0][0] as FeedbackInsert;
    expect(row).toEqual({
      id: NEW_ID,
      userId: USER_ID,
      kind: "day",
      rating: 4,
      message: "The map was slow",
      festivalId: FESTIVAL_ID,
      day: "2026-09-23",
      platform: "ios",
      appVersion: "1.9.0",
      locale: "de",
    });
    expect(repo.recordPrompt).toHaveBeenCalledWith(USER_ID, FESTIVAL_ID, "2026-09-23", "answered");
    expect(notifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        id: NEW_ID,
        kind: "day",
        rating: 4,
        festivalName: "Oktoberfest 2026",
        username: "sepp",
        userEmail: "sepp@example.com",
      }),
    );
  });

  it("stores whitespace-only day text as no message", async () => {
    const repo = fakeRepo();
    await service(repo).submit(CONTEXT, {
      kind: "day",
      rating: 3,
      message: "   ",
      festivalId: FESTIVAL_ID,
      day: "2026-09-23",
    });
    expect(vi.mocked(repo.insertFeedback).mock.calls[0][0].message).toBeNull();
  });

  it("rejects a day rating for a day without drinks", async () => {
    const repo = fakeRepo({ hasLoggedDay: vi.fn().mockResolvedValue(false) });
    await expect(
      service(repo).submit(CONTEXT, { kind: "day", rating: 3, festivalId: FESTIVAL_ID, day: "2026-09-20" }),
    ).rejects.toMatchObject({ statusCode: 400, code: ErrorCodes.FEEDBACK_DAY_NOT_LOGGED });
    expect(repo.insertFeedback).not.toHaveBeenCalled();
  });

  it("returns the stored id and sends no second email on a double tap", async () => {
    const repo = fakeRepo({
      insertFeedback: vi.fn().mockResolvedValue("duplicate"),
      findDayFeedbackId: vi.fn().mockResolvedValue("55555555-5555-4555-8555-555555555555"),
    });
    const notifier = fakeNotifier();
    const result = await service(repo, notifier).submit(CONTEXT, {
      kind: "day",
      rating: 5,
      message: "Great",
      festivalId: FESTIVAL_ID,
      day: "2026-09-23",
    });
    expect(result).toEqual({ id: "55555555-5555-4555-8555-555555555555" });
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("stores and emails a bug report without a festival", async () => {
    const repo = fakeRepo();
    const notifier = fakeNotifier();
    await service(repo, notifier).submit(CONTEXT, { kind: "bug", message: "It crashed" });
    expect(vi.mocked(repo.insertFeedback).mock.calls[0][0]).toMatchObject({
      kind: "bug",
      rating: null,
      festivalId: null,
      day: null,
    });
    expect(repo.getFestivalName).not.toHaveBeenCalled();
    expect(repo.recordPrompt).not.toHaveBeenCalled();
    expect(notifier.notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "bug", festivalName: null }));
  });

  it("answers 429 and sends no email when the database rate limit refuses the row", async () => {
    const repo = fakeRepo({ insertFeedback: vi.fn().mockResolvedValue("rate_limited") });
    const notifier = fakeNotifier();
    await expect(
      service(repo, notifier).submit(CONTEXT, { kind: "idea", message: "Dark mode" }),
    ).rejects.toMatchObject({
      statusCode: 429,
      code: ErrorCodes.FEEDBACK_RATE_LIMITED,
    });
    expect(notifier.notify).not.toHaveBeenCalled();
  });
});
