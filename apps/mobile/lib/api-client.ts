/**
 * API client for React Native mobile app
 *
 * Uses the shared typed client factory from @prostcounter/api-client
 * with platform-specific auth configuration.
 */

import {
  ApiError,
  AuthRequiredError,
  type ApiHeaders,
  type ClientPlatform,
  createTypedApiClient,
} from "@prostcounter/api-client";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { logger } from "./logger";
import { supabase } from "./supabase";

// Re-export ApiError for convenience
export { ApiError, AuthRequiredError };

/**
 * Base URL for API requests
 * Configured via Expo constants or environment variable
 */
const API_BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  (typeof process !== "undefined" ? process.env.EXPO_PUBLIC_API_URL : "") ||
  "http://localhost:3008/api";

// Log API configuration on startup
logger.info("API Client initialized", {
  baseUrl: API_BASE_URL,
  hasExpoConfig: !!Constants.expoConfig?.extra?.apiUrl,
  hasEnvVar: !!(typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_URL),
});

const BASE_HEADERS: ApiHeaders = { "Content-Type": "application/json" };

function withAuth(token: string): ApiHeaders {
  return { ...BASE_HEADERS, Authorization: `Bearer ${token}` };
}

/**
 * Get auth headers for API requests using the Supabase mobile client.
 *
 * supabase-js owns token refresh: getSession() refreshes an expired token
 * internally and dedupes concurrent refreshes. If no usable token is
 * available afterward, we THROW rather than send an anonymous request that
 * would deterministically 401.
 */
async function getAuthHeaders(): Promise<ApiHeaders> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    return withAuth(session.access_token);
  }

  throw new AuthRequiredError();
}

/**
 * Platform.OS also has "web" | "windows" | "macos", none of which this app
 * ships. Anything unexpected sends no header at all, so the server records NULL
 * instead of a value that would quietly misattribute the session.
 */
const CLIENT_PLATFORM: ClientPlatform | undefined =
  Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined;

/**
 * Type-safe API client instance for the mobile app
 */
export const apiClient = createTypedApiClient({
  baseUrl: API_BASE_URL,
  getAuthHeaders,
  clientPlatform: CLIENT_PLATFORM,
  // app.config.ts `version`, so this is the user-facing app version (1.7.0),
  // not the runtimeVersion and not the mobile package.json version.
  clientVersion: Constants.expoConfig?.version ?? undefined,
  onRequest: (method, url, headers) => {
    logger.logApiRequest(method, url, headers);
  },
  onResponse: (method, url, status, data) => {
    logger.logApiResponse(method, url, status, data);
  },
  onError: (method, url, error) => {
    logger.logApiError(method, url, error);
  },
});
