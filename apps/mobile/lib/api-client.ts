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

// Mutex to prevent concurrent token refresh calls
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error || !refreshed.session?.access_token) {
    logger.warn("Supabase session refresh failed", {
      hasError: !!error,
    });
    return null;
  }
  return refreshed.session.access_token;
}

/**
 * Get auth headers for API requests using Supabase mobile client
 */
async function getAuthHeaders(): Promise<ApiHeaders> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    // Check if the token is expired or about to expire (within 60s)
    const expiresAt = session.expires_at; // Unix timestamp in seconds
    const now = Math.floor(Date.now() / 1000);

    if (expiresAt && expiresAt - now < 60) {
      // Deduplicate concurrent refresh calls with a shared promise
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;

      if (newToken) {
        return {
          Authorization: `Bearer ${newToken}`,
          "Content-Type": "application/json",
        };
      }

      // Refresh failed — if token is already expired, don't send it
      if (expiresAt <= now) {
        return {
          "Content-Type": "application/json",
        };
      }
    }

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
