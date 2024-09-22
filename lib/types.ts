import type { Session } from "@supabase/supabase-js";

export type MaybeSession = Session | null;

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
