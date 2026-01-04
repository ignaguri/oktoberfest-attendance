import * as Sentry from "@sentry/nextjs";

import { APP_VERSION } from "./lib/version";

Sentry.init({
  dsn: "https://976065906ffaab22c65cb37405653cea@o4507997605527552.ingest.de.sentry.io/4507997611098192",
  tracesSampleRate: 1,
  debug: false,
  release: APP_VERSION,
});
