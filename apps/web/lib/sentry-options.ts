import { isExpectedAuthStatus } from "@prostcounter/shared/errors";

// Sentry 11 collects cookies, bodies, user info and DB queries when
// `dataCollection` is unset. This keeps the Sentry 10 default (sendDefaultPii off).
const SENSITIVE_KEYS = { deny: ["forwarded", "-ip", "remote-", "via", "-user"] };

// Sentry 11 drops the "vercel-" prefix from the default environment on Vercel,
// which would stop matching existing alert rules and dashboards. Off Vercel it
// defaults to "production", so local dev is tagged by NODE_ENV instead.
const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
export const sentryEnvironment = vercelEnv ? `vercel-${vercelEnv}` : process.env.NODE_ENV;

// The Hono integration's default filter reads `error.status`, but our ApiError
// carries `statusCode`, so every 401 was reported as an unhandled error.
export function shouldReportHonoError(error: unknown): boolean {
  const { status, statusCode } = (error ?? {}) as { status?: unknown; statusCode?: unknown };
  const code = typeof statusCode === "number" ? statusCode : status;
  const isRedirect = typeof code === "number" && code >= 300 && code < 400;
  return !isRedirect && !isExpectedAuthStatus(code);
}

export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: SENSITIVE_KEYS, response: SENSITIVE_KEYS },
  httpBodies: [],
  urlQueryParams: SENSITIVE_KEYS,
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
};
