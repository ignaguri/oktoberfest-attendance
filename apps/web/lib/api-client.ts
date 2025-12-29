import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { hc } from "hono/client";

import type { App } from "@prostcounter/api";

/**
 * API Client Factory
 * Creates a type-safe Hono RPC client with automatic authentication
 */
export const createApiClient = async () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3008";

  // Get current session token
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  // Create Hono RPC client with auth headers
  const client = hc<App>(baseUrl, {
    headers,
  });

  return client;
};

/**
 * Get API client with current authentication
 * Call this function to get a fresh client with the latest session token
 *
 * @example
 * const api = await getApiClient();
 * const response = await api.v1.consumption.$post({ json: { ... } });
 * const data = await response.json();
 */
export const getApiClient = createApiClient;
