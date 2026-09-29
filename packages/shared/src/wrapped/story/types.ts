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
  breakdown: { drinkType: string; count: number; label: CopyRef }[];
  top: CopyRef | null;
  spent: CopyRef | null;
}

export interface DaysSlide extends SlideBase {
  kind: "days";
  title: CopyRef;
  bars: { date: string; beers: number; attended: boolean; tents: number }[];
  maxBeers: number;
  bestDay: { date: string; callout: CopyRef; details: CopyRef } | null;
}

export interface TentsSlide extends SlideBase {
  kind: "tents";
  title: CopyRef;
  favorite: CopyRef | null;
  count: CopyRef;
  share: CopyRef | null;
  topTents: { name: string; visits: number; isFavorite: boolean }[];
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
  rows: { stat: CopyRef; caption: CopyRef }[];
}

/** A figure as a big stat over its caption. */
export interface StatCard {
  stat: CopyRef;
  caption: CopyRef;
}

export interface WiesnAndYouSlide extends SlideBase {
  kind: "wiesnAndYou";
  kicker: CopyRef;
  visitors: StatCard | null;
  share: StatCard | null;
  mugs: StatCard | null;
  lostAndFound: StatCard | null;
  findsLabel: CopyRef;
  finds: CuriousFind[];
  source: CopyRef;
  checkBack: CopyRef | null;
}

export interface BadgesSlide extends SlideBase {
  kind: "badges";
  title: CopyRef;
  count: StatCard;
  /** "+6 more in your collection", when there are more than the top three. */
  more: CopyRef | null;
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
  recap: { personaId: PersonaId; name: string; facts: CopyRef[] };
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
  | BadgesSlide
  | PersonaSlide
  | ProstSlide;

export type StorySlideKind = StorySlide["kind"];

export type StorySlideOf<K extends StorySlideKind> = Extract<StorySlide, { kind: K }>;
