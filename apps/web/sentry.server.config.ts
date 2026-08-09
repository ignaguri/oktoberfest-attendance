// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { APP_VERSION } from "./lib/version";
import { INVALID_CREDENTIALS_MESSAGE } from "./utils/sentry";

Sentry.init({
  dsn: "https://976065906ffaab22c65cb37405653cea@o4507997605527552.ingest.de.sentry.io/4507997611098192",

  // A failed sign-in throws out of the login server action so the form can show
  // a message. Next's onRequestError hook reports every such throw, which made
  // each wrong password produce a second Sentry event (PROST-COUNTER-8D) on top
  // of the one reportSupabaseAuthException already suppresses.
  ignoreErrors: [INVALID_CREDENTIALS_MESSAGE],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  release: APP_VERSION,
});
