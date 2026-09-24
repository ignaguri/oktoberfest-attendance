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
