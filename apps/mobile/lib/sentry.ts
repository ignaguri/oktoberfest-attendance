/**
 * Sentry initialization for error monitoring and performance tracking
 */

import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const SENTRY_DSN =
  Constants.expoConfig?.extra?.sentryDsn ||
  (typeof process !== "undefined" ? process.env.EXPO_PUBLIC_SENTRY_DSN : "") ||
  "";

/**
 * Initialize Sentry for the mobile app
 * Called early in the app lifecycle
 */
export function initSentry() {
  // Only initialize if DSN is configured
  if (!SENTRY_DSN) {
    if (__DEV__) {
      console.warn(
        "[Sentry] No DSN configured. Error monitoring disabled. Set EXPO_PUBLIC_SENTRY_DSN to enable.",
      );
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Enable in production only
    enabled: !__DEV__,

    // Sample 20% of transactions for performance monitoring in production
    tracesSampleRate: 0.2,

    // Set environment
    environment: __DEV__ ? "development" : "production",

    // Release version from app config (format: slug@version+buildNumber)
    release: `${Constants.expoConfig?.slug}@${Constants.expoConfig?.version}+${
      Constants.expoConfig?.ios?.buildNumber ||
      Constants.expoConfig?.android?.versionCode?.toString() ||
      "1"
    }`,

    // Distribution (build number)
    dist:
      Constants.expoConfig?.ios?.buildNumber ||
      Constants.expoConfig?.android?.versionCode?.toString() ||
      "1",

    // Enable automatic session tracking
    enableAutoSessionTracking: true,

    // Sessions close after 30 seconds of inactivity
    sessionTrackingIntervalMillis: 30000,

    // Attach stack traces to messages
    attachStacktrace: true,

    // Enable native crash handling
    enableNative: true,

    // Enable automatic breadcrumbs
    enableAutoPerformanceTracing: true,

    // Integrations - simplified for compatibility with SDK 54
    integrations: [],

    // Before sending events, filter out noise
    beforeSend(event, hint) {
      // Filter out known non-critical errors
      if (event.exception) {
        const error = hint.originalException;

        // Ignore cancelled fetch requests
        if (error instanceof Error && error.name === "AbortError") {
          return null;
        }

        // Ignore network errors in development
        if (
          __DEV__ &&
          error instanceof TypeError &&
          error.message.includes("Network request failed")
        ) {
          return null;
        }
      }

      return event;
    },
  });

  if (__DEV__) {
    console.log("[Sentry] Initialized successfully");
  }
}

// Export Sentry for direct use
export { Sentry };
