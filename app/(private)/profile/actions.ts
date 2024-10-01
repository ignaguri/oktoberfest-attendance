"use server";

import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

import "server-only";

export async function updateProfile({
  id,
  fullname,
  username,
  custom_beer_cost,
}: {
  id: string;
  fullname?: string;
  username?: string;
  custom_beer_cost?: number;
}) {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").upsert({
    id,
    full_name: fullname,
    username,
    custom_beer_cost,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    reportSupabaseException("updateProfile", error, { id });
    throw new Error(error.message);
  }

  revalidatePath("/profile");
  revalidatePath("/home", "layout");
  revalidatePath("/home", "page");
}
