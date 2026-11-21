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
 * Deletes a user's account. Removing the auth user cascades to their profile
 * and all data that references it; Storage files don't cascade, so those go
 * first. Requires service role key.
 */
export async function deleteAuthUser(userId: string): Promise<void> {
  const adminClient = createAdminClient();

  const { data: objects, error: listError } = await adminClient.rpc("user_storage_objects", {
    p_user_id: userId,
  });
  if (listError) {
    throw new Error(`Failed to list user storage objects: ${listError.message}`);
  }

  const namesByBucket = new Map<string, string[]>();
  for (const object of objects ?? []) {
    namesByBucket.set(object.bucket_id, [
      ...(namesByBucket.get(object.bucket_id) ?? []),
      object.name,
    ]);
  }
  for (const [bucket, names] of namesByBucket) {
    const { error: removeError } = await adminClient.storage.from(bucket).remove(names);
    if (removeError) {
      throw new Error(`Failed to remove ${bucket} files: ${removeError.message}`);
    }
  }

  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(`Failed to delete auth user: ${error.message}`);
  }
}
