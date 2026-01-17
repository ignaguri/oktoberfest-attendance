import type { Database } from "@prostcounter/db";
import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with service role key for admin operations
 * This client bypasses RLS and has full database access
 * Use sparingly and only for operations that require elevated privileges
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials not configured");
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Deletes a user from Supabase Auth
 * Requires service role key
 */
export async function deleteAuthUser(userId: string): Promise<void> {
  const adminClient = createAdminClient();

  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(`Failed to delete auth user: ${error.message}`);
  }
}
