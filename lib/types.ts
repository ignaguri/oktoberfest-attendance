import type { Database } from "./database.types";
import type { createServerClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

// Type for the Supabase client returned by createClient()
export type SupabaseClient = ReturnType<typeof createServerClient<Database>>;

export type MaybeSession = Session | null;

// Multi-Festival Types
export type Festival = Database["public"]["Tables"]["festivals"]["Row"];
export type FestivalInsert =
  Database["public"]["Tables"]["festivals"]["Insert"];
export type FestivalUpdate =
  Database["public"]["Tables"]["festivals"]["Update"];

export type FestivalType = Database["public"]["Enums"]["festival_type_enum"];
export type FestivalStatus =
  Database["public"]["Enums"]["festival_status_enum"];

export type FestivalTent =
  Database["public"]["Tables"]["festival_tents"]["Row"];
export type FestivalTentInsert =
  Database["public"]["Tables"]["festival_tents"]["Insert"];

// Updated core types with festival_id
export type Attendance = Database["public"]["Tables"]["attendances"]["Row"];
export type AttendanceInsert =
  Database["public"]["Tables"]["attendances"]["Insert"];

export type Group = Database["public"]["Tables"]["groups"]["Row"];
export type GroupInsert = Database["public"]["Tables"]["groups"]["Insert"];

export type TentVisit = Database["public"]["Tables"]["tent_visits"]["Row"];

// Festival Stats
export type UserFestivalStats = {
  total_beers: number;
  days_attended: number;
  avg_beers: number;
  total_spent: number;
  favorite_tent: string | null;
  most_expensive_day: number | null;
};

export enum WinningCriteria {
  days_attended = "days_attended",
  total_beers = "total_beers",
  avg_beers = "avg_beers",
}

export const WinningCriteriaValues = {
  days_attended: WinningCriteria.days_attended,
  total_beers: WinningCriteria.total_beers,
  avg_beers: WinningCriteria.avg_beers,
} as const;

export interface GalleryImage {
  id: string;
  url: string;
  uploadedAt: string;
  userId: string;
  username: string;
}

export interface GalleryData {
  [date: string]: {
    [userId: string]: GalleryImage[];
  };
}

export interface PictureData {
  id: string;
  url: string;
  uploadedAt: string;
}

export interface GalleryItem {
  date: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  picture_data: PictureData[];
}

export type CalendarEventType =
  | "attendance"
  | "reservation"
  | "beer_summary"
  | "tent_visit";
