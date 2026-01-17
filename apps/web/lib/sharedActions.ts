"use server";

import "server-only";

import * as Sentry from "@sentry/nextjs";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/server";

/**
 * Get the current authenticated user from Supabase Auth.
 * Used for server-side auth checks in layouts and API routes.
 * @throws Error if user is not authenticated
 */
export async function getUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not found");
  }

  Sentry.setUser({ email: user.email, id: user.id }); // Set the user in Sentry
  return user;
}
