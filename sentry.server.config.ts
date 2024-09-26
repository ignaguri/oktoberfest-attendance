// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { APP_VERSION } from "./version";

Sentry.init({
  dsn: "https://976065906ffaab22c65cb37405653cea@o4507997605527552.ingest.de.sentry.io/4507997611098192",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  release: APP_VERSION,
});
