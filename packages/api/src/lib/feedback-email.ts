import { FEEDBACK_FACES, type FeedbackKind } from "@prostcounter/shared";

import { logger } from "./logger";

export interface FeedbackEmailPayload {
  id: string;
  kind: FeedbackKind;
  rating: number | null;
  message: string | null;
  festivalName: string | null;
  day: string | null;
  username: string | null;
  userEmail: string | null;
  platform: string | null;
  appVersion: string | null;
  locale: string | null;
  createdAt: string;
}

export interface FeedbackNotifier {
  notify(payload: FeedbackEmailPayload): Promise<void>;
}

/** `notify.` per docs/EMAIL.md: never `account.`, which carries auth tokens. */
export const FEEDBACK_EMAIL_FROM = "ProstCounter Feedback <feedback@notify.prostcounter.fun>";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

/** submit awaits the send, so a hung Resend must not hang the request. */
export const FEEDBACK_EMAIL_TIMEOUT_MS = 5000;
const SUBJECT_PREVIEW_LENGTH = 60;

/** Every bug and idea; a day rating only when it came with text. */
export function shouldEmailFeedback(kind: FeedbackKind, message: string | null): boolean {
  return kind !== "day" || (message !== null && message.trim() !== "");
}

export function buildFeedbackEmail(payload: FeedbackEmailPayload): { subject: string; text: string } {
  const face = FEEDBACK_FACES.find((entry) => entry.rating === payload.rating)?.emoji ?? "?";
  const preview = (payload.message ?? "").replace(/\s+/g, " ").trim().slice(0, SUBJECT_PREVIEW_LENGTH);

  let subject: string;
  if (payload.kind === "bug") {
    subject = `[Bug] ${preview}`;
  } else if (payload.kind === "idea") {
    subject = `[Idea] ${preview}`;
  } else {
    subject = `[Day ${face}] ${payload.festivalName ?? "Unknown festival"}, ${payload.day ?? "?"}`;
  }

  const lines = [
    `Kind: ${payload.kind}`,
    ...(payload.rating !== null ? [`Rating: ${face} (${payload.rating}/5)`] : []),
    "",
    payload.message?.trim() || "(no message)",
    "",
    "---",
    `User: ${payload.username ?? "unknown"}${payload.userEmail ? ` <${payload.userEmail}>` : ""}`,
    `Festival: ${payload.festivalName ?? "-"}`,
    ...(payload.day ? [`Day: ${payload.day}`] : []),
    `Platform: ${payload.platform ?? "-"}`,
    `App version: ${payload.appVersion ?? "-"}`,
    `Locale: ${payload.locale ?? "-"}`,
    `Sent: ${payload.createdAt}`,
    `Feedback id: ${payload.id}`,
  ];

  return { subject, text: lines.join("\n") };
}

/**
 * Emails the admin inbox through the Resend REST API.
 *
 * Never throws: the feedback row is already stored when this runs, so a mail
 * failure is logged and the submission still succeeds.
 */
export function createResendFeedbackNotifier(
  env: { RESEND_API_KEY?: string; FEEDBACK_NOTIFY_EMAIL?: string },
  fetchImpl: typeof fetch = fetch,
): FeedbackNotifier {
  return {
    async notify(payload) {
      if (!shouldEmailFeedback(payload.kind, payload.message)) {
        return;
      }
      if (!env.RESEND_API_KEY || !env.FEEDBACK_NOTIFY_EMAIL) {
        logger.info(
          { feedbackId: payload.id },
          "Feedback email skipped: RESEND_API_KEY or FEEDBACK_NOTIFY_EMAIL not set",
        );
        return;
      }

      const { subject, text } = buildFeedbackEmail(payload);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FEEDBACK_EMAIL_TIMEOUT_MS);

      try {
        const response = await fetchImpl(RESEND_EMAILS_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FEEDBACK_EMAIL_FROM,
            to: [env.FEEDBACK_NOTIFY_EMAIL],
            subject,
            text,
            ...(payload.userEmail ? { reply_to: payload.userEmail } : {}),
          }),
        });
        if (!response.ok) {
          logger.error(
            { feedbackId: payload.id, status: response.status, body: await response.text() },
            "Feedback email rejected by Resend",
          );
        }
      } catch (error) {
        logger.error(
          { feedbackId: payload.id, error: error instanceof Error ? error.message : String(error) },
          "Feedback email request failed",
        );
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}
