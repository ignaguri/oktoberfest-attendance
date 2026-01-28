/**
 * API client for React Native mobile app
 *
 * Uses the shared typed client factory from @prostcounter/api-client
 * with platform-specific auth configuration.
 */

import {
  ApiError,
  type ApiHeaders,
  createTypedApiClient,
} from "@prostcounter/api-client";
import Constants from "expo-constants";

import { logger } from "./logger";
import { supabase } from "./supabase";

// Re-export ApiError for convenience
export { ApiError };

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
  hasEnvVar: !!(
    typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_URL
  ),
});

/**
 * Get auth headers for API requests using Supabase mobile client
 */
async function getAuthHeaders(): Promise<ApiHeaders> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  }

  return {
    "Content-Type": "application/json",
  };
}

/**
 * Type-safe API client instance for the mobile app
 */
export const apiClient = createTypedApiClient({
  baseUrl: API_BASE_URL,
  getAuthHeaders,
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
