import { createBrowserClient } from "@supabase/ssr/dist/module/createBrowserClient.js";

import type { Database } from "@/lib/database.types";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
