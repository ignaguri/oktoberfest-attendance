"use server";

import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

import type { Festival, FestivalInsert, FestivalUpdate } from "@/lib/types";

import "server-only";

export async function fetchAllFestivals(): Promise<Festival[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("festivals")
    .select("*")
    .order("start_date", { ascending: false });

  if (error) {
    reportSupabaseException("fetchAllFestivals", error);
    throw new Error(`Error fetching festivals: ${error.message}`);
  }

  return data || [];
}

export async function createFestival(
  festivalData: Omit<FestivalInsert, "id" | "created_at" | "updated_at">,
): Promise<Festival> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("festivals")
    .insert(festivalData)
    .select()
    .single();

  if (error) {
    reportSupabaseException("createFestival", error);
    throw new Error(`Error creating festival: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/");

  return data;
}

export async function updateFestival(
  festivalId: string,
  festivalData: Omit<FestivalUpdate, "id" | "created_at" | "updated_at">,
): Promise<Festival> {
  const supabase = await createClient();

  const updateData = {
    ...festivalData,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("festivals")
    .update(updateData)
    .eq("id", festivalId)
    .select()
    .single();

  if (error) {
    reportSupabaseException("updateFestival", error);
    throw new Error(`Error updating festival: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/");

  return data;
}

export async function deleteFestival(festivalId: string): Promise<void> {
  const supabase = await createClient();

  // First check if this festival has any associated data
  const { data: attendances, error: attendancesError } = await supabase
    .from("attendances")
    .select("id")
    .eq("festival_id", festivalId)
    .limit(1);

  if (attendancesError) {
    reportSupabaseException(
      "deleteFestival - check attendances",
      attendancesError,
    );
    throw new Error(
      `Error checking festival attendances: ${attendancesError.message}`,
    );
  }

  if (attendances && attendances.length > 0) {
    throw new Error(
      "Cannot delete festival with existing attendance data. Please archive the festival instead.",
    );
  }

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id")
    .eq("festival_id", festivalId)
    .limit(1);

  if (groupsError) {
    reportSupabaseException("deleteFestival - check groups", groupsError);
    throw new Error(`Error checking festival groups: ${groupsError.message}`);
  }

  if (groups && groups.length > 0) {
    throw new Error(
      "Cannot delete festival with existing groups. Please archive the festival instead.",
    );
  }

  // If no associated data, safe to delete
  const { error } = await supabase
    .from("festivals")
    .delete()
    .eq("id", festivalId);

  if (error) {
    reportSupabaseException("deleteFestival", error);
    throw new Error(`Error deleting festival: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/");
}
