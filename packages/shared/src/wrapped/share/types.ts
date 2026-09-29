import type { WrappedOfficialStats } from "../../schemas/wrapped.schema";
import type { PersonaId } from "../story/persona";
import type { CopyRef, StatCard } from "../story/types";

export const SHARE_CARD_KINDS = [
  "numbers",
  "persona",
  "rhythm",
  "city",
  "photos",
] as const;
export type ShareCardKind = (typeof SHARE_CARD_KINDS)[number];

/** Photos carry a visibility flag and friends' faces, so they are never published by link. */
export const LINKABLE_SHARE_CARD_KINDS = [
  "numbers",
  "persona",
  "rhythm",
  "city",
] as const;
export type LinkableShareCardKind = (typeof LINKABLE_SHARE_CARD_KINDS)[number];

interface ShareCardBase {
  /** "My Oktoberfest 2026" */
  kicker: CopyRef;
}

export interface NumbersShareCard extends ShareCardBase {
  kind: "numbers";
  /** Total beers, or days attended when there were none. */
  value: number;
  unit: CopyRef;
  comparison: CopyRef | null;
  boxes: StatCard[];
  homeTent: CopyRef | null;
}

export interface PersonaShareCard extends ShareCardBase {
  kind: "persona";
  personaId: PersonaId;
  name: string;
  description: CopyRef;
  facts: CopyRef[];
}

export interface RhythmShareCard extends ShareCardBase {
  kind: "rhythm";
  title: CopyRef;
  bars: { date: string; beers: number; attended: boolean; tents: number }[];
  bestDay: { date: string; beers: CopyRef } | null;
}

export interface CityShareCard extends ShareCardBase {
  kind: "city";
  title: CopyRef;
  visitors: StatCard | null;
  share: StatCard | null;
  mugs: StatCard | null;
  source: CopyRef;
}

export interface PhotosShareCard extends ShareCardBase {
  kind: "photos";
  title: CopyRef;
  photos: { id: string; pictureUrl: string }[];
  groups: CopyRef | null;
  bestPlacing: CopyRef | null;
}

export type ShareCard =
  | NumbersShareCard
  | PersonaShareCard
  | RhythmShareCard
  | CityShareCard
  | PhotosShareCard;

export type ShareCardOf<K extends ShareCardKind> = Extract<
  ShareCard,
  { kind: K }
>;

/** What the Prost slide needs beyond the Wrapped itself to offer and fetch cards. */
export interface WrappedShareContext {
  festivalId: string;
  officialStats: WrappedOfficialStats | null;
}
