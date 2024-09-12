"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function fetchAttendances() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return [];
  }

  const { data, error } = await supabase
    .from("attendances")
    .select("*")
    .eq("user_id", user?.id)
    .order("date", { ascending: true });

  if (error) {
    throw new Error("Error fetching attendance: " + error.message);
  }

  return data;
}

export async function addAttendance(formData: { amount: number; date: Date }) {
  const { amount, date } = formData;

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return;
  }

  const { error } = await supabase.from("attendances").upsert(
    {
      user_id: user.id,
      date: date.toISOString(),
      beer_count: amount,
    },
    {
      onConflict: "date",
    },
  );

  if (error) {
    throw new Error("Error adding attendance: " + error.message);
  }

  revalidatePath("/attendance");
}
