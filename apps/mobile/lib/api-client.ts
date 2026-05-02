/**
 * API client for React Native mobile app
 *
 * Uses the shared typed client factory from @prostcounter/api-client
 * with platform-specific auth configuration.
 */

import { ApiError, type ApiHeaders, createTypedApiClient } from "@prostcounter/api-client";
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
  hasEnvVar: !!(typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_URL),
});

const BASE_HEADERS: ApiHeaders = { "Content-Type": "application/json" };

function withAuth(token: string): ApiHeaders {
  return { ...BASE_HEADERS, Authorization: `Bearer ${token}` };
}

// Deduplicates concurrent token refresh calls
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session?.access_token) {
      logger.warn("Supabase session refresh failed", {
        hasError: !!error,
      });
      return null;
    }
    return refreshed.session.access_token;
  } catch {
    logger.warn("Supabase session refresh threw an exception");
    return null;
  }
}

/**
 * Get auth headers for API requests using Supabase mobile client
 */
async function getAuthHeaders(): Promise<ApiHeaders> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);

    // Proactively refresh tokens near expiry to avoid 401s on app resume
    if (expiresAt && expiresAt - now < 60) {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;

      if (newToken) {
        return withAuth(newToken);
      }

      // Refresh failed — don't send an already-expired token
      if (expiresAt <= now) {
        return BASE_HEADERS;
      }
      // Token not yet expired, send it and accept it may expire mid-flight
    }

    return withAuth(session.access_token);
  }

  return BASE_HEADERS;
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
