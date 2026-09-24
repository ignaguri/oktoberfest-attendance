import { randomUUID } from "crypto";
import type {
  AdminFeedbackItem,
  DayFeedbackPrompt,
  FeedbackKind,
  SubmitFeedbackBody,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";

import type { FeedbackNotifier } from "../lib/feedback-email";
import { ApiError, ValidationError } from "../middleware/error";
import type { FeedbackInsert, IFeedbackRepository } from "../repositories/interfaces";
import { isPromptAllowed, pickCandidateDay } from "./feedback-prompt-rule";

/** Bug reports plus ideas one user may send per rolling 24 hours. */
export const TEXT_FEEDBACK_DAILY_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Far enough back to cover "yesterday" in any festival timezone. */
const LOGGED_DAY_LOOKBACK_DAYS = 3;

export interface FeedbackSubmitContext {
  userId: string;
  userEmail: string | null;
  platform: string | null;
  appVersion: string | null;
}

export class FeedbackService {
  constructor(
    private repo: IFeedbackRepository,
    private notifier: FeedbackNotifier,
    private now: () => Date = () => new Date(),
    private newId: () => string = () => randomUUID(),
  ) {}

  async getDayPrompt(userId: string): Promise<DayFeedbackPrompt | null> {
    const now = this.now();
    const sinceDay = new Date(now.getTime() - LOGGED_DAY_LOOKBACK_DAYS * DAY_MS)
      .toISOString()
      .slice(0, 10);

    const candidate = pickCandidateDay(now, await this.repo.listLoggedDaysSince(userId, sinceDay));
    if (!candidate) {
      return null;
    }

    const [prompts, loggedDaysInFestival] = await Promise.all([
      this.repo.listPrompts(userId),
      this.repo.countLoggedDays(userId, candidate.festivalId),
    ]);
    if (!isPromptAllowed({ now, candidate, prompts, loggedDaysInFestival })) {
      return null;
    }

    return {
      festivalId: candidate.festivalId,
      festivalName: candidate.festivalName,
      day: candidate.day,
    };
  }

  async dismissDayPrompt(userId: string, festivalId: string, day: string): Promise<void> {
    await this.repo.recordPrompt(userId, festivalId, day, "dismissed");
  }

  async submit(context: FeedbackSubmitContext, body: SubmitFeedbackBody): Promise<{ id: string }> {
    if (body.kind === "day") {
      const logged = await this.repo.hasLoggedDay(context.userId, body.festivalId, body.day);
      if (!logged) {
        throw new ValidationError(ErrorCodes.FEEDBACK_DAY_NOT_LOGGED);
      }
    } else {
      const since = new Date(this.now().getTime() - DAY_MS).toISOString();
      const recent = await this.repo.countSubmissionsSince(context.userId, ["bug", "idea"], since);
      if (recent >= TEXT_FEEDBACK_DAILY_LIMIT) {
        throw new ApiError(429, ErrorCodes.FEEDBACK_RATE_LIMITED);
      }
    }

    const submitter = await this.repo.getSubmitter(context.userId);
    const message = body.message && body.message.trim() !== "" ? body.message.trim() : null;
    const id = this.newId();
    const row: FeedbackInsert = {
      id,
      userId: context.userId,
      kind: body.kind,
      rating: body.kind === "day" ? body.rating : null,
      message,
      festivalId: body.festivalId ?? null,
      day: body.kind === "day" ? body.day : null,
      platform: context.platform,
      appVersion: context.appVersion,
      locale: submitter.preferredLanguage,
    };

    const outcome = await this.repo.insertFeedback(row);
    if (body.kind === "day") {
      await this.repo.recordPrompt(context.userId, body.festivalId, body.day, "answered");
    }

    if (outcome === "duplicate") {
      // A retried day rating that already landed: report the stored row, no second email
      const existingId =
        body.kind === "day"
          ? await this.repo.findDayFeedbackId(context.userId, body.festivalId, body.day)
          : null;
      return { id: existingId ?? id };
    }

    const festivalName = row.festivalId ? await this.repo.getFestivalName(row.festivalId) : null;
    await this.notifier.notify({
      id,
      kind: row.kind,
      rating: row.rating,
      message,
      festivalName,
      day: row.day,
      username: submitter.username,
      userEmail: context.userEmail,
      platform: context.platform,
      appVersion: context.appVersion,
      locale: row.locale,
      createdAt: this.now().toISOString(),
    });

    return { id };
  }

  async listForAdmin(query: { kind?: FeedbackKind; limit: number }): Promise<AdminFeedbackItem[]> {
    return this.repo.listForAdmin(query);
  }
}
