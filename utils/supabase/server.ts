import { createServerClient } from "@supabase/ssr/dist/module/createServerClient.js";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";

import "server-only";

export function createClient(withServiceRole: boolean = false) {
  const cookieStore = cookies();

  // Create a server's supabase client with newly configured cookie,
  // which could be used to maintain user's session
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    withServiceRole
      ? process.env.SUPABASE_SERVICE_ROLE_KEY!
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return (await cookieStore).getAll();
        },
        async setAll(cookiesToSet) {
          try {
            await Promise.all(
              cookiesToSet.map(async ({ name, value, options }) =>
                (await cookieStore).set(name, value, options),
              ),
            );
          } catch {
            // Do nothing if cookies cannot be set
          }
        },
      },
    },
  );
}
