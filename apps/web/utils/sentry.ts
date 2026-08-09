import type { SeverityLevel } from "@sentry/nextjs";
import * as Sentry from "@sentry/nextjs";
import type { AuthError, PostgrestError } from "@supabase/supabase-js";

export const reportSupabaseException = (
  fnName: string,
  error: PostgrestError,
  userData?: { email?: string; id: string },
) => {
  const errorDetails = JSON.stringify({
    code: error.code,
    details: error.details,
    hint: error.hint,
    message: error.message,
  });

  if (userData) {
    Sentry.setUser(userData);
  }

  Sentry.captureException(new Error(`Supabase Error in action "${fnName}": ${errorDetails}`));
};

/**
 * Message the login action throws when credentials don't match. Deliberately
 * generic so it doesn't reveal whether the account exists.
 *
 * Also listed in sentry.server.config.ts's ignoreErrors: the throw escapes the
 * server action into Next's onRequestError hook, which reports it a second time
 * on top of reportSupabaseAuthException.
 */
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

/**
 * Auth failures that are ordinary user behavior rather than defects: a mistyped
 * password, an unconfirmed email, a duplicate signup.
 *
 * These were the single largest source of Sentry events in the project
 * (PROST-COUNTER-8C, 373 events), which buried real auth bugs and stored the
 * typed-in email address of everyone who fat-fingered a password.
 */
const EXPECTED_AUTH_ERROR_CODES = new Set([
  "invalid_credentials",
  "email_not_confirmed",
  "user_already_exists",
  "weak_password",
  "same_password",
]);

export const reportSupabaseAuthException = (
  fnName: string,
  error: AuthError,
  userData?: { email?: string; id?: string; provider?: string },
) => {
  if (error.code && EXPECTED_AUTH_ERROR_CODES.has(error.code)) {
    return;
  }

  const errorDetails = JSON.stringify({
    code: error.code,
    status: error.status,
    name: error.name,
    message: error.message,
    userData,
  });

  if (userData) {
    Sentry.setUser(userData);
  }

  Sentry.captureException(new Error(`Supabase Auth Error in action "${fnName}": ${errorDetails}`));
};

export const reportNotificationException = (
  fnName: string,
  error: Error,
  userData?: { email?: string; id: string },
) => {
  if (userData) {
    Sentry.setUser(userData);
  }

  Sentry.captureException(new Error(`Notification Error in action "${fnName}": ${error.message}`));
};

export const reportApiException = (
  fnName: string,
  error: Error,
  userData?: { email?: string; id: string },
) => {
  if (userData) {
    Sentry.setUser(userData);
  }

  Sentry.captureException(new Error(`API Error in action "${fnName}": ${error.message}`));
};

export const reportLog = (message: string, level: SeverityLevel) => {
  Sentry.captureMessage(message, level);
};
