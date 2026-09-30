import type { WrappedData } from "../../schemas/wrapped.schema";
import type { CopyRef } from "./types";

/** Priority order: ties go to the earlier id. */
export const PERSONA_IDS = [
  "einmalAberRichtig",
  "massMeister",
  "marathoner",
  "zeltwanderer",
  "stammgast",
  "fruehschoppen",
  "nachteule",
  "radlerDiplomat",
  "wochenendKrieger",
  "geniesser",
] as const;

export type PersonaId = (typeof PERSONA_IDS)[number];

/** Persona names stay German in every locale. */
export const PERSONA_NAMES: Record<PersonaId, string> = {
  einmalAberRichtig: "Einmal, aber richtig",
  massMeister: "Maß-Meister",
  marathoner: "Wiesn-Marathoner",
  zeltwanderer: "Der Zeltwanderer",
  stammgast: "Der Stammgast",
  fruehschoppen: "Frühschoppen-Profi",
  nachteule: "Nachteule",
  radlerDiplomat: "Radler-Diplomat",
  wochenendKrieger: "Wochenend-Krieger",
  geniesser: "Der Genießer",
};

/** Outside Oktoberfest a name can't say Wiesn; the rest fit any festival. */
const GENERIC_PERSONA_NAMES: Partial<Record<PersonaId, string>> = {
  marathoner: "Fest-Marathoner",
};

export function personaName(id: PersonaId, isWiesn: boolean): string {
  return (isWiesn ? undefined : GENERIC_PERSONA_NAMES[id]) ?? PERSONA_NAMES[id];
}

/** Crest PNG basenames (mobile assets/wrapped/crests, web public/wrapped/crests). */
export const PERSONA_CREST_FILES: Record<PersonaId, string> = {
  einmalAberRichtig: "einmal-aber-richtig",
  massMeister: "mass-meister",
  marathoner: "marathoner",
  zeltwanderer: "zeltwanderer",
  stammgast: "stammgast",
  fruehschoppen: "fruehschoppen",
  nachteule: "nachteule",
  radlerDiplomat: "radler-diplomat",
  wochenendKrieger: "wochenend-krieger",
  geniesser: "geniesser",
};

export interface PersonaSignals {
  festivalDays: number;
  attendanceRatio: number;
  daysAttended: number;
  totalBeers: number;
  avgBeers: number;
  tentDiversityPct: number;
  uniqueTents: number;
  topTent: string | null;
  topTentVisits: number;
  topTentShare: number;
  tentVisits: number;
  totalDrinks: number;
  softShare: number;
  timedDays: number;
  medianFirstHour: number | null;
  medianLastHour: number | null;
  weekendShare: number | null;
}

export interface Persona {
  id: PersonaId;
  runnerUpId: PersonaId | null;
  because: CopyRef;
}

const DAY_MS = 86_400_000;

export function festivalDayCount(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.round((end - start) / DAY_MS) + 1;
}

/** Fractional hours (24.25 = 00:15 the next night) as HH:mm. */
export function formatHour(hour: number): string {
  const totalMinutes = Math.round(hour * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function personaSignals(data: WrappedData): PersonaSignals {
  const festivalDays = festivalDayCount(data.festivalInfo.startDate, data.festivalInfo.endDate);
  const breakdown = data.tentStats.tentBreakdown;
  const tentVisits = breakdown.reduce((sum, tent) => sum + tent.visitCount, 0);
  const topTentRow = breakdown.reduce<(typeof breakdown)[number] | null>(
    (best, tent) => (best === null || tent.visitCount > best.visitCount ? tent : best),
    null,
  );
  const softDrinks = data.drinkStats.breakdown
    .filter((drink) => drink.drinkType === "radler" || drink.drinkType === "alcohol_free")
    .reduce((sum, drink) => sum + drink.count, 0);

  return {
    festivalDays,
    attendanceRatio: festivalDays > 0 ? data.basicStats.daysAttended / festivalDays : 0,
    daysAttended: data.basicStats.daysAttended,
    totalBeers: data.basicStats.totalBeers,
    avgBeers: data.basicStats.avgBeers,
    tentDiversityPct: data.tentStats.tentDiversityPct,
    uniqueTents: data.tentStats.uniqueTents,
    topTent: topTentRow?.tentName ?? null,
    topTentVisits: topTentRow?.visitCount ?? 0,
    topTentShare: tentVisits > 0 ? (topTentRow?.visitCount ?? 0) / tentVisits : 0,
    tentVisits,
    totalDrinks: data.drinkStats.totalDrinks,
    softShare: data.drinkStats.totalDrinks > 0 ? softDrinks / data.drinkStats.totalDrinks : 0,
    timedDays: data.timing.timedDays,
    medianFirstHour: data.timing.medianFirstHour,
    medianLastHour: data.timing.medianLastHour,
    weekendShare: data.timing.weekendShare,
  };
}

const cap = (value: number) => Math.min(value, 2);

/**
 * Each rule returns its strength when it qualifies, otherwise null. Thresholds
 * were tuned against production data (Oktoberfest 2025 and 2026, Frühlingsfest
 * 2026) so that no persona takes more than ~35% of attendees and Der Genießer
 * stays under ~30%. Most people come 1-3 days and drink 2-4 a day, which is
 * why the bars sit lower than the names suggest.
 *
 * The persona collection shows each rule as copy
 * (wrapped.story.persona.<id>.hint in all three locales). Change a threshold
 * here and that hint must change with it.
 */
const RULES: { id: Exclude<PersonaId, "geniesser">; strength: (s: PersonaSignals) => number | null }[] = [
  {
    id: "einmalAberRichtig",
    strength: (s) => (s.daysAttended === 1 && s.totalBeers >= 2 ? cap(s.totalBeers / 2) : null),
  },
  { id: "massMeister", strength: (s) => (s.avgBeers >= 4 ? cap(s.avgBeers / 4) : null) },
  {
    id: "marathoner",
    strength: (s) =>
      s.attendanceRatio >= 0.3 && s.daysAttended >= 5 ? cap(s.attendanceRatio / 0.3) : null,
  },
  // A tent count, not the diversity share: 40% of the 40 Wiesn tents is 16, which nobody visits.
  { id: "zeltwanderer", strength: (s) => (s.uniqueTents >= 4 ? cap(s.uniqueTents / 4) : null) },
  {
    id: "stammgast",
    strength: (s) => (s.topTentShare >= 0.6 && s.tentVisits >= 3 ? cap(s.topTentShare / 0.6) : null),
  },
  {
    id: "fruehschoppen",
    strength: (s) =>
      s.timedDays >= 1 && s.medianFirstHour !== null && s.medianFirstHour < 13
        ? cap((18 - s.medianFirstHour) / 5)
        : null,
  },
  {
    id: "nachteule",
    strength: (s) =>
      s.timedDays >= 1 && s.medianLastHour !== null && s.medianLastHour >= 21.5
        ? cap((s.medianLastHour - 18) / 3.5)
        : null,
  },
  {
    id: "radlerDiplomat",
    strength: (s) => (s.totalDrinks >= 3 && s.softShare >= 0.3 ? cap(s.softShare / 0.3) : null),
  },
  {
    id: "wochenendKrieger",
    strength: (s) => (s.daysAttended >= 1 && s.totalBeers > 0 && s.weekendShare === 1 ? 1 : null),
  },
];

function festivalTentCount(s: PersonaSignals): number {
  return s.tentDiversityPct > 0 ? Math.round((s.uniqueTents * 100) / s.tentDiversityPct) : s.uniqueTents;
}

function becauseFor(id: PersonaId, s: PersonaSignals): CopyRef {
  const key = `wrapped.story.persona.${id}.because`;
  switch (id) {
    case "einmalAberRichtig":
      return { key, params: { beers: s.totalBeers } };
    case "massMeister":
      return { key, params: { avg: s.avgBeers } };
    case "marathoner":
      return { key, params: { days: s.daysAttended, festivalDays: s.festivalDays } };
    case "zeltwanderer":
      return { key, params: { tents: s.uniqueTents, totalTents: festivalTentCount(s) } };
    case "stammgast":
      return { key, params: { tent: s.topTent ?? "", visits: s.topTentVisits } };
    case "fruehschoppen":
      return { key, params: { time: formatHour(s.medianFirstHour ?? 0) } };
    case "nachteule":
      return { key, params: { time: formatHour(s.medianLastHour ?? 0) } };
    case "radlerDiplomat":
      return { key, params: { pct: Math.round(s.softShare * 100) } };
    case "wochenendKrieger":
      return { key, params: { count: s.daysAttended } };
    case "geniesser":
      return { key, params: { count: s.daysAttended, beers: s.totalBeers } };
  }
}

export function derivePersona(data: WrappedData): Persona {
  const signals = personaSignals(data);
  const ranked = RULES.map((rule) => ({ id: rule.id, strength: rule.strength(signals) }))
    .filter((rule): rule is { id: Exclude<PersonaId, "geniesser">; strength: number } => rule.strength !== null)
    // Array.prototype.sort is stable, so equal strengths keep priority order
    .sort((a, b) => b.strength - a.strength);

  const id: PersonaId = ranked[0]?.id ?? "geniesser";

  return {
    id,
    runnerUpId: ranked[1]?.id ?? null,
    because: becauseFor(id, signals),
  };
}
