import type { Database } from "@prostcounter/db";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Create Supabase admin client for integration tests
 * Uses service role key to bypass RLS policies
 * Use for test setup/teardown operations
 */
export function createTestSupabaseAdmin(): SupabaseClient<Database> {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing required environment variables: (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set for integration tests",
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

/**
 * Create Supabase anon client for integration tests
 * Uses anon key and respects RLS policies
 * Use for testing actual user operations
 */
export function createTestSupabaseAnon(): SupabaseClient<Database> {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing required environment variables: (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL) and (SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY) must be set for integration tests",
    );
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

/**
 * Create authenticated Supabase client with user token
 * Respects RLS policies with user context
 */
export function createTestSupabaseWithAuth(
  token: string,
): SupabaseClient<Database> {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing required environment variables: (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL) and (SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY) must be set for integration tests",
    );
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}
