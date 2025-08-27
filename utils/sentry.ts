import * as Sentry from "@sentry/nextjs";

import type { SeverityLevel } from "@sentry/nextjs";
import type { PostgrestError } from "@supabase/supabase-js";

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

  Sentry.captureException(
    new Error(`Supabase Error in action "${fnName}": ${errorDetails}`),
  );
};

export const reportNotificationException = (
  fnName: string,
  error: Error,
  userData?: { email?: string; id: string },
) => {
  if (userData) {
    Sentry.setUser(userData);
  }

  Sentry.captureException(
    new Error(`Notification Error in action "${fnName}": ${error.message}`),
  );
};

export const reportLog = (message: string, level: SeverityLevel) => {
  Sentry.captureMessage(message, level);
};
