import * as Sentry from "@sentry/nextjs";

import type { SeverityLevel } from "@sentry/nextjs";
import type { PostgrestError } from "@supabase/supabase-js";

export const reportSupabaseException = (error: PostgrestError) => {
  const errorDetails = JSON.stringify({
    code: error.code,
    details: error.details,
    hint: error.hint,
    message: error.message,
  });
  Sentry.captureException(new Error(`Supabase Error: ${errorDetails}`));
};

export const reportLog = (message: string, level: SeverityLevel) => {
  Sentry.captureMessage(message, level);
};
