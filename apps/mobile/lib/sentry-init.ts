import { Platform } from "react-native";

import { initSentry } from "./sentry";

// A side-effect module so index.js can start Sentry before the task modules load:
// headless background runs never mount app/_layout.tsx.
if (Platform.OS !== "web") {
  initSentry();
}
