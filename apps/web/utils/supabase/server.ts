import "server-only";

import type { Database } from "@prostcounter/db";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient(withServiceRole: boolean = false) {
  // Service role client doesn't need cookies - it bypasses RLS
  if (withServiceRole) {
    return createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            // Service role doesn't need to set cookies
          },
        },
      },
    );
  }

  // Regular client needs cookies for user session
  const cookieStore = await cookies();

  // Create a server's supabase client with newly configured cookie,
  // which could be used to maintain user's session
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Do nothing if cookies cannot be set
          }
        },
      },
    },
  );
}
