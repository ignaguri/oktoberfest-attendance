"use server";

import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { v4 as uuidv4 } from "uuid";

import type { Tables } from "@/lib/database.types";

import "server-only";

// Types for tent management
export type TentWithPrice = {
  id: string;
  name: string;
  category: string | null;
  beer_price: number | null;
  festival_tent_id?: string;
};

export type TentInsert = Omit<Tables<"tents">, "id">;
export type FestivalTentInsert = {
  festival_id: string;
  tent_id: string;
  beer_price?: number | null;
};

/**
 * Get all tents available for a specific festival
 */
export async function getFestivalTents(
  festivalId: string,
): Promise<TentWithPrice[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("festival_tents")
    .select(
      `
      id,
      beer_price,
      tent:tents!inner (
        id,
        name,
        category
      )
    `,
    )
    .eq("festival_id", festivalId)
    .order("tent.name", { ascending: true });

  if (error) {
    reportSupabaseException("getFestivalTents", error);
    throw new Error(`Error fetching festival tents: ${error.message}`);
  }

  // Transform the data to flat structure
  return (data || []).map((item: any) => ({
    id: item.tent.id,
    name: item.tent.name,
    category: item.tent.category,
    beer_price: item.beer_price,
    festival_tent_id: item.id,
  }));
}

/**
 * Get all tents not currently assigned to a specific festival
 */
export async function getAvailableTents(
  festivalId: string,
): Promise<Tables<"tents">[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tents")
    .select("*")
    .not(
      "id",
      "in",
      `(
      SELECT tent_id
      FROM festival_tents
      WHERE festival_id = '${festivalId}'
    )`,
    )
    .order("name", { ascending: true });

  if (error) {
    reportSupabaseException("getAvailableTents", error);
    throw new Error(`Error fetching available tents: ${error.message}`);
  }

  return data || [];
}

/**
 * Add a tent to a festival with optional pricing
 */
export async function addTentToFestival(
  festivalId: string,
  tentId: string,
  beerPrice?: number | null,
): Promise<void> {
  const supabase = createClient();

  const insertData: FestivalTentInsert = {
    festival_id: festivalId,
    tent_id: tentId,
    beer_price: beerPrice,
  };

  const { error } = await supabase.from("festival_tents").insert(insertData);

  if (error) {
    reportSupabaseException("addTentToFestival", error);
    throw new Error(`Error adding tent to festival: ${error.message}`);
  }

  // Invalidate caches
  revalidatePath("/admin");
  revalidateTag("tents");
  revalidateTag(`festival-tents-${festivalId}`);
}

/**
 * Remove a tent from a festival
 */
export async function removeTentFromFestival(
  festivalId: string,
  tentId: string,
): Promise<void> {
  const supabase = createClient();

  // Check if tent has any attendance records first
  const { count: attendanceCount } = await supabase
    .from("tent_visits")
    .select("*", { count: "exact", head: true })
    .eq("festival_id", festivalId)
    .eq("tent_id", tentId);

  if (attendanceCount && attendanceCount > 0) {
    throw new Error(
      "Cannot remove tent that has attendance records. Users have visited this tent.",
    );
  }

  const { error } = await supabase
    .from("festival_tents")
    .delete()
    .eq("festival_id", festivalId)
    .eq("tent_id", tentId);

  if (error) {
    reportSupabaseException("removeTentFromFestival", error);
    throw new Error(`Error removing tent from festival: ${error.message}`);
  }

  // Invalidate caches
  revalidatePath("/admin");
  revalidateTag("tents");
  revalidateTag(`festival-tents-${festivalId}`);
}

/**
 * Update tent pricing for a specific festival
 */
export async function updateTentPrice(
  festivalId: string,
  tentId: string,
  beerPrice: number | null,
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("festival_tents")
    .update({ beer_price: beerPrice })
    .eq("festival_id", festivalId)
    .eq("tent_id", tentId);

  if (error) {
    reportSupabaseException("updateTentPrice", error);
    throw new Error(`Error updating tent price: ${error.message}`);
  }

  // Invalidate caches
  revalidatePath("/admin");
  revalidateTag(`festival-tents-${festivalId}`);
}

/**
 * Create a new tent and optionally add it to a festival
 */
export async function createTent(
  tentData: TentInsert,
  festivalId?: string,
  beerPrice?: number | null,
): Promise<Tables<"tents">> {
  const supabase = createClient();

  // Create the tent with generated ID
  const tentWithId = { ...tentData, id: uuidv4() };
  const { data: tent, error: tentError } = await supabase
    .from("tents")
    .insert(tentWithId)
    .select()
    .single();

  if (tentError) {
    reportSupabaseException("createTent", tentError);
    throw new Error(`Error creating tent: ${tentError.message}`);
  }

  // If festival ID provided, add tent to that festival
  if (festivalId && tent) {
    await addTentToFestival(festivalId, tent.id, beerPrice);
  }

  // Invalidate caches
  revalidatePath("/admin");
  revalidateTag("tents");
  if (festivalId) {
    revalidateTag(`festival-tents-${festivalId}`);
  }

  return tent;
}

/**
 * Update tent information (name, category)
 */
export async function updateTent(
  tentId: string,
  tentData: Partial<TentInsert>,
): Promise<Tables<"tents">> {
  const supabase = createClient();

  const { data: tent, error } = await supabase
    .from("tents")
    .update(tentData)
    .eq("id", tentId)
    .select()
    .single();

  if (error) {
    reportSupabaseException("updateTent", error);
    throw new Error(`Error updating tent: ${error.message}`);
  }

  // Invalidate caches
  revalidatePath("/admin");
  revalidateTag("tents");

  return tent;
}

/**
 * Copy tents from one festival to another
 */
export async function copyTentsToFestival(
  sourceFestivalId: string,
  targetFestivalId: string,
  tentIds: string[],
  options: {
    copyPrices?: boolean;
    overridePrice?: number | null;
  } = {},
): Promise<void> {
  const supabase = createClient();

  // Get source festival tents
  const { data: sourceTents, error: fetchError } = await supabase
    .from("festival_tents")
    .select("tent_id, beer_price")
    .eq("festival_id", sourceFestivalId)
    .in("tent_id", tentIds);

  if (fetchError) {
    reportSupabaseException("copyTentsToFestival", fetchError);
    throw new Error(`Error fetching source tents: ${fetchError.message}`);
  }

  if (!sourceTents || sourceTents.length === 0) {
    throw new Error("No tents found to copy");
  }

  // Prepare insert data
  const insertData = sourceTents.map((tent) => ({
    festival_id: targetFestivalId,
    tent_id: tent.tent_id,
    beer_price:
      options.overridePrice !== undefined
        ? options.overridePrice
        : options.copyPrices
          ? tent.beer_price
          : null,
  }));

  // Insert tents (ignore conflicts - tent already exists in target festival)
  const { error: insertError } = await supabase
    .from("festival_tents")
    .upsert(insertData, {
      onConflict: "festival_id,tent_id",
      ignoreDuplicates: true,
    });

  if (insertError) {
    reportSupabaseException("copyTentsToFestival", insertError);
    throw new Error(`Error copying tents to festival: ${insertError.message}`);
  }

  // Invalidate caches
  revalidatePath("/admin");
  revalidateTag("tents");
  revalidateTag(`festival-tents-${targetFestivalId}`);
}

/**
 * Get festival tent statistics
 */
export async function getFestivalTentStats(festivalId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("festival_tents")
    .select(
      `
      tent:tents!inner (category),
      beer_price
    `,
    )
    .eq("festival_id", festivalId);

  if (error) {
    reportSupabaseException("getFestivalTentStats", error);
    throw new Error(`Error fetching tent stats: ${error.message}`);
  }

  const stats = {
    total_tents: data?.length || 0,
    categories: {} as Record<string, number>,
    with_custom_pricing: 0,
    avg_price: 0,
  };

  if (data) {
    const prices: number[] = [];

    data.forEach((item: any) => {
      const category = item.tent?.category || "Uncategorized";
      stats.categories[category] = (stats.categories[category] || 0) + 1;

      if (item.beer_price) {
        stats.with_custom_pricing++;
        prices.push(item.beer_price);
      }
    });

    if (prices.length > 0) {
      stats.avg_price =
        prices.reduce((sum, price) => sum + price, 0) / prices.length;
    }
  }

  return stats;
}
