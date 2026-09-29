import type { CuriousFind } from "../../schemas/wrapped.schema";
import type { PersonaId } from "./persona";

/** An i18n key plus its params; views translate it with useStoryCopy. */
export interface CopyRef {
  key: string;
  params?: Record<string, string | number>;
}

interface SlideBase {
  /** Number of reveal steps; the shell times the reveal from it. */
  revealSteps: number;
}

export interface ServusSlide extends SlideBase {
  kind: "servus";
  avatarUrl: string | null;
  startDate: string;
  endDate: string;
  title: CopyRef;
  subtitle: CopyRef;
}

export interface BigNumberSlide extends SlideBase {
  kind: "bigNumber";
  variant: "normal" | "low" | "zero";
  beers: number;
  kicker: CopyRef;
  unit: CopyRef;
  tagline: CopyRef;
  comparison: CopyRef | null;
}

export interface DrinksSlide extends SlideBase {
  kind: "drinks";
  title: CopyRef;
  breakdown: { drinkType: string; count: number; percentage: number; label: CopyRef }[];
  top: CopyRef | null;
  spent: CopyRef | null;
}

export interface DaysSlide extends SlideBase {
  kind: "days";
  title: CopyRef;
  bars: { date: string; beers: number; attended: boolean }[];
  maxBeers: number;
  bestDay: { date: string; callout: CopyRef; details: CopyRef } | null;
}

export interface TentsSlide extends SlideBase {
  kind: "tents";
  title: CopyRef;
  favorite: CopyRef | null;
  count: CopyRef;
  share: CopyRef | null;
  topTents: { name: string; visits: number }[];
}

export interface PeopleSlide extends SlideBase {
  kind: "people";
  title: CopyRef;
  groups: CopyRef | null;
  bestPlacing: CopyRef | null;
  photosLabel: CopyRef | null;
  photos: { id: string; pictureUrl: string }[];
}

export interface CompareSlide extends SlideBase {
  kind: "compare";
  title: CopyRef;
  rows: CopyRef[];
}

export interface WiesnAndYouSlide extends SlideBase {
  kind: "wiesnAndYou";
  kicker: CopyRef;
  headline: CopyRef;
  share: CopyRef | null;
  source: CopyRef;
}

export interface MeanwhileSlide extends SlideBase {
  kind: "meanwhile";
  kicker: CopyRef;
  mugs: number | null;
  mugsLine: CopyRef | null;
  findsLabel: CopyRef;
  finds: CuriousFind[];
  lostItems: CopyRef | null;
  source: CopyRef;
}

export interface BadgesSlide extends SlideBase {
  kind: "badges";
  title: CopyRef;
  count: CopyRef;
  top: {
    id: string;
    /** achievements.name is a translation key, so it travels as a CopyRef. */
    name: CopyRef;
    icon: string;
    category: string;
    tier: number;
    rarity: string;
    points: number;
  }[];
}

export interface PersonaSlide extends SlideBase {
  kind: "persona";
  kicker: CopyRef;
  personaId: PersonaId;
  name: string;
  description: CopyRef;
  because: CopyRef;
  runnerUp: CopyRef | null;
}

export interface ProstSlide extends SlideBase {
  kind: "prost";
  title: CopyRef;
  summary: CopyRef;
}

export type StorySlide =
  | ServusSlide
  | BigNumberSlide
  | DrinksSlide
  | DaysSlide
  | TentsSlide
  | PeopleSlide
  | CompareSlide
  | WiesnAndYouSlide
  | MeanwhileSlide
  | BadgesSlide
  | PersonaSlide
  | ProstSlide;

export type StorySlideKind = StorySlide["kind"];

export type StorySlideOf<K extends StorySlideKind> = Extract<StorySlide, { kind: K }>;
