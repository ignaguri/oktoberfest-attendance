// Sentry 11 collects cookies, bodies, user info and DB queries when
// `dataCollection` is unset. This keeps the Sentry 10 default (sendDefaultPii off).
const SENSITIVE_KEYS = { deny: ["forwarded", "-ip", "remote-", "via", "-user"] };

// Sentry 11 drops the "vercel-" prefix from the default environment on Vercel,
// which would stop matching existing alert rules and dashboards.
const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
export const sentryEnvironment = vercelEnv ? `vercel-${vercelEnv}` : undefined;

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
