"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile({
  id,
  fullname,
  username,
}: {
  id: string;
  fullname?: string;
  username?: string;
}) {
  const supabase = createClient();

  const { error } = await supabase.from("profiles").upsert({
    id,
    full_name: fullname,
    username,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile");
}
