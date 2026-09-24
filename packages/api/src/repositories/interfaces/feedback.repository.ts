import type { AdminFeedbackItem, FeedbackKind } from "@prostcounter/shared";

/** A day with at least one drink logged, with the festival's clock. */
export interface LoggedDay {
  festivalId: string;
  festivalName: string;
  timezone: string;
  /** YYYY-MM-DD */
  day: string;
}

export type FeedbackPromptOutcome = "answered" | "dismissed";

/** One day prompt the user already saw. */
export interface PromptRecord {
  festivalId: string;
  /** YYYY-MM-DD */
  day: string;
  outcome: FeedbackPromptOutcome;
  /** ISO timestamp */
  createdAt: string;
}

export interface FeedbackInsert {
  id: string;
  userId: string;
  kind: FeedbackKind;
  rating: number | null;
  message: string | null;
  festivalId: string | null;
  day: string | null;
  platform: string | null;
  appVersion: string | null;
  locale: string | null;
}

export interface FeedbackSubmitter {
  username: string | null;
  preferredLanguage: string | null;
}

/**
 * Feedback submissions and the day-prompt log. Reads run with the caller's
 * token, so RLS scopes every user query to their own rows.
 */
export interface IFeedbackRepository {
  /** Days with at least one drink, on or after sinceDay (YYYY-MM-DD). */
  listLoggedDaysSince(userId: string, sinceDay: string): Promise<LoggedDay[]>;
  countLoggedDays(userId: string, festivalId: string): Promise<number>;
  hasLoggedDay(userId: string, festivalId: string, day: string): Promise<boolean>;
  listPrompts(userId: string): Promise<PromptRecord[]>;
  /** Keeps the first outcome for a day; later calls for the same day do nothing. */
  recordPrompt(
    userId: string,
    festivalId: string,
    day: string,
    outcome: FeedbackPromptOutcome,
  ): Promise<void>;
  /**
   * "duplicate" when a rating for that user, festival and day already exists;
   * "rate_limited" when the database trigger refuses a bug or idea past the cap.
   */
  insertFeedback(row: FeedbackInsert): Promise<"inserted" | "duplicate" | "rate_limited">;
  findDayFeedbackId(userId: string, festivalId: string, day: string): Promise<string | null>;
  getSubmitter(userId: string): Promise<FeedbackSubmitter>;
  getFestivalName(festivalId: string): Promise<string | null>;
  listForAdmin(query: { kind?: FeedbackKind; limit: number }): Promise<AdminFeedbackItem[]>;
}
