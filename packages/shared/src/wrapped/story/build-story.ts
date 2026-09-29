import type { WrappedData, WrappedOfficialStats } from "../../schemas/wrapped.schema";
import { getBestGlobalPosition } from "../utils";
import { derivePersona, festivalDayCount, PERSONA_NAMES } from "./persona";
import type {
  BadgesSlide,
  BigNumberSlide,
  CompareSlide,
  CopyRef,
  DaysSlide,
  DrinksSlide,
  MeanwhileSlide,
  PeopleSlide,
  PersonaSlide,
  ProstSlide,
  ServusSlide,
  StorySlide,
  TentsSlide,
  WiesnAndYouSlide,
} from "./types";

/** Below this many attendees, percentiles and averages mean nothing. */
export const TINY_FESTIVAL_ATTENDEES = 10;
const LOW_BEERS = 3;
const FLATTERING_PERCENTILE = 50;
const SAME_AS_AVERAGE_PCT = 5;
const MAX_PHOTOS = 4;
const MAX_BADGES = 3;
const MAX_TENTS = 3;
const KNOWN_DRINK_TYPES = ["beer", "radler", "alcohol_free", "wine", "soft_drink", "other"];

const copy = (key: string, params?: CopyRef["params"]): CopyRef =>
  params ? { key: `wrapped.story.${key}`, params } : { key: `wrapped.story.${key}` };

const drinkTypeKey = (drinkType: string) =>
  KNOWN_DRINK_TYPES.includes(drinkType) ? drinkType : "other";

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function seriesName(festivalName: string): string {
  return festivalName.replace(/\s+\d{4}\s*$/, "").trim();
}

function sourceCopy(stats: WrappedOfficialStats): CopyRef {
  if (stats.sourceUrl) {
    try {
      const host = new URL(stats.sourceUrl).hostname.replace(/^www\./, "");
      return copy("source.withHost", { host, year: stats.year });
    } catch {
      // An unparsable URL falls through to the plain line
    }
  }
  return copy("source.plain", { year: stats.year });
}

function servusSlide(data: WrappedData): ServusSlide {
  const name = data.userInfo.fullName?.trim() || data.userInfo.username || null;
  return {
    kind: "servus",
    revealSteps: 4,
    avatarUrl: data.userInfo.avatarUrl,
    startDate: data.festivalInfo.startDate,
    endDate: data.festivalInfo.endDate,
    title: name ? copy("servus.title", { name }) : copy("servus.titleNoName"),
    subtitle: copy("servus.subtitle", { festival: data.festivalInfo.name }),
  };
}

function bigNumberSlide(data: WrappedData, tiny: boolean): BigNumberSlide {
  const beers = data.basicStats.totalBeers;
  const variant = beers === 0 ? "zero" : beers < LOW_BEERS ? "low" : "normal";
  const { beersPercentile, medianBeers } = data.comparisons.vsFestivalAvg;

  let comparison: CopyRef | null = null;
  if (!tiny && beers > 0) {
    comparison =
      beersPercentile >= FLATTERING_PERCENTILE
        ? copy("bigNumber.comparison.percentile", { pct: beersPercentile })
        : copy("bigNumber.comparison.median", { median: medianBeers });
  }

  return {
    kind: "bigNumber",
    revealSteps: 4,
    variant,
    beers,
    kicker: copy("bigNumber.kicker", { festival: data.festivalInfo.name }),
    unit: copy("bigNumber.unit", { count: beers }),
    tagline:
      variant === "normal"
        ? copy("bigNumber.tagline.normal", { count: data.basicStats.daysAttended })
        : copy(`bigNumber.tagline.${variant}`),
    comparison,
  };
}

function drinksSlide(data: WrappedData): DrinksSlide | null {
  const { totalDrinks, topDrinkType, breakdown } = data.drinkStats;
  if (totalDrinks <= 0) {
    return null;
  }
  return {
    kind: "drinks",
    revealSteps: 3,
    title: copy("drinks.title"),
    breakdown: breakdown.map((drink) => ({
      drinkType: drink.drinkType,
      count: drink.count,
      percentage: drink.percentage,
      label: copy(`drinkTypes.${drinkTypeKey(drink.drinkType)}`),
    })),
    top: topDrinkType ? copy(`drinks.top.${drinkTypeKey(topDrinkType)}`) : null,
    spent: data.basicStats.totalSpent > 0 ? copy("drinks.spent", { amount: data.basicStats.totalSpent }) : null,
  };
}

function daysSlide(data: WrappedData): DaysSlide | null {
  if (!data.timeline.some((day) => day.beerCount > 0)) {
    return null;
  }
  const beersByDate = new Map(data.timeline.map((day) => [day.date, day.beerCount]));
  const dayCount = festivalDayCount(data.festivalInfo.startDate, data.festivalInfo.endDate);
  const bars = Array.from({ length: dayCount }, (_, offset) => {
    const date = addDays(data.festivalInfo.startDate, offset);
    return { date, beers: beersByDate.get(date) ?? 0, attended: beersByDate.has(date) };
  });
  const best = data.peakMoments.bestDay;

  return {
    kind: "days",
    revealSteps: 3,
    title: copy("days.title"),
    bars,
    maxBeers: Math.max(1, ...bars.map((bar) => bar.beers)),
    bestDay:
      best && best.beerCount > 0
        ? {
            date: best.date,
            callout: copy("days.best", { beers: best.beerCount }),
            details: copy("days.bestDetails", { count: best.tentsVisited }),
          }
        : null,
  };
}

function tentsSlide(data: WrappedData): TentsSlide | null {
  const { uniqueTents, favoriteTent, tentDiversityPct, tentBreakdown } = data.tentStats;
  if (uniqueTents <= 0) {
    return null;
  }
  return {
    kind: "tents",
    revealSteps: 4,
    title: copy("tents.title"),
    favorite: favoriteTent ? copy("tents.favorite", { tent: favoriteTent }) : null,
    count: copy("tents.count", { count: uniqueTents }),
    share: tentDiversityPct > 0 ? copy("tents.share", { pct: tentDiversityPct }) : null,
    topTents: [...tentBreakdown]
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, MAX_TENTS)
      .map((tent) => ({ name: tent.tentName, visits: tent.visitCount })),
  };
}

function peopleSlide(data: WrappedData): PeopleSlide | null {
  const { groupsJoined, topRankings, pictures } = data.socialStats;
  const photos = pictures.slice(0, MAX_PHOTOS).map((picture) => ({
    id: picture.id,
    pictureUrl: picture.pictureUrl,
  }));
  if (groupsJoined === 0 && photos.length === 0) {
    return null;
  }
  const best = [...topRankings].sort((a, b) => a.position - b.position)[0];
  return {
    kind: "people",
    revealSteps: 3,
    title: copy("people.title"),
    groups: groupsJoined > 0 ? copy("people.groups", { count: groupsJoined }) : null,
    bestPlacing: best ? copy("people.bestPlacing", { position: best.position, group: best.groupName }) : null,
    photosLabel: photos.length > 0 ? copy("people.photosLabel") : null,
    photos,
  };
}

function compareSlide(data: WrappedData, tiny: boolean): CompareSlide | null {
  const { vsFestivalAvg, vsLastYear } = data.comparisons;
  const best = tiny ? null : getBestGlobalPosition(data);
  if (!vsLastYear && !best) {
    return null;
  }

  const rows: CopyRef[] = [];
  if (!tiny) {
    const diff = vsFestivalAvg.beersDiffPct;
    if (Math.abs(diff) < SAME_AS_AVERAGE_PCT) {
      rows.push(copy("compare.vsAvg.same"));
    } else if (diff > 0) {
      rows.push(copy("compare.vsAvg.more", { pct: diff }));
    } else {
      rows.push(copy("compare.vsAvg.less", { pct: -diff }));
    }
  }
  if (vsLastYear) {
    const festival = vsLastYear.prevFestivalName;
    if (vsLastYear.beersDiff > 0) {
      rows.push(copy("compare.vsLastYear.up", { diff: vsLastYear.beersDiff, festival }));
    } else if (vsLastYear.beersDiff < 0) {
      rows.push(copy("compare.vsLastYear.down", { diff: -vsLastYear.beersDiff, festival }));
    } else {
      rows.push(copy("compare.vsLastYear.same", { festival }));
    }
  }
  if (best) {
    rows.push(copy(`compare.global.${best.criteria}`, { position: best.position }));
  }

  return { kind: "compare", revealSteps: rows.length + 1, title: copy("compare.title"), rows };
}

function wiesnAndYouSlide(data: WrappedData, stats: WrappedOfficialStats | null): WiesnAndYouSlide | null {
  if (!stats || stats.visitors === null || stats.massServed === null) {
    return null;
  }
  const when = stats.isCurrentFestival ? "current" : "lastYear";
  const beers = data.basicStats.totalBeers;
  return {
    kind: "wiesnAndYou",
    revealSteps: 3,
    kicker: copy(`wiesnAndYou.kicker.${when}`, { year: stats.year }),
    headline: copy(`wiesnAndYou.headline.${when}`, { visitors: stats.visitors }),
    share:
      beers > 0 && stats.massServed > 0
        ? copy(`wiesnAndYou.share.${when}`, {
            count: beers,
            pct: (beers / stats.massServed) * 100,
            mass: stats.massServed,
          })
        : null,
    source: sourceCopy(stats),
  };
}

function meanwhileSlide(stats: WrappedOfficialStats | null): MeanwhileSlide | null {
  if (!stats || (stats.mugsConfiscated === null && stats.curiousFinds.length === 0)) {
    return null;
  }
  const when = stats.isCurrentFestival ? "current" : "lastYear";
  return {
    kind: "meanwhile",
    revealSteps: 2 + stats.curiousFinds.length,
    kicker: copy("meanwhile.kicker"),
    mugs: stats.mugsConfiscated,
    mugsLine: stats.mugsConfiscated !== null ? copy(`meanwhile.mugs.${when}`) : null,
    findsLabel: copy("meanwhile.findsLabel"),
    finds: stats.curiousFinds,
    lostItems: stats.lostItems !== null ? copy("meanwhile.lostItems", { count: stats.lostItems }) : null,
    source: sourceCopy(stats),
  };
}

function badgesSlide(data: WrappedData): BadgesSlide | null {
  if (data.achievements.length === 0) {
    return null;
  }
  const top = [...data.achievements]
    .sort((a, b) => b.tier - a.tier || b.points - a.points)
    .slice(0, MAX_BADGES)
    .map((achievement) => ({
      id: achievement.id,
      name: { key: achievement.name },
      icon: achievement.icon,
      category: achievement.category,
      tier: achievement.tier,
      rarity: achievement.rarity,
      points: achievement.points,
    }));
  return {
    kind: "badges",
    revealSteps: 1 + top.length,
    title: copy("badges.title"),
    count: copy("badges.count", { count: data.achievements.length }),
    top,
  };
}

function personaSlide(data: WrappedData): PersonaSlide {
  const persona = derivePersona(data);
  return {
    kind: "persona",
    revealSteps: 5,
    kicker: copy("persona.kicker"),
    personaId: persona.id,
    name: PERSONA_NAMES[persona.id],
    description: copy(`persona.${persona.id}.description`),
    because: persona.because,
    runnerUp: persona.runnerUpId ? copy("persona.runnerUp", { name: PERSONA_NAMES[persona.runnerUpId] }) : null,
  };
}

function prostSlide(data: WrappedData): ProstSlide {
  return {
    kind: "prost",
    revealSteps: 2,
    title: copy("prost.title"),
    summary: copy("prost.summary", { series: seriesName(data.festivalInfo.name) }),
  };
}

/** The ordered story for one Wrapped. Pure: views only translate and animate. */
export function buildWrappedStory(
  data: WrappedData,
  officialStats: WrappedOfficialStats | null,
): StorySlide[] {
  const tiny = data.comparisons.vsFestivalAvg.attendeeCount < TINY_FESTIVAL_ATTENDEES;
  const slides: (StorySlide | null)[] = [
    servusSlide(data),
    bigNumberSlide(data, tiny),
    drinksSlide(data),
    daysSlide(data),
    tentsSlide(data),
    peopleSlide(data),
    compareSlide(data, tiny),
    wiesnAndYouSlide(data, officialStats),
    meanwhileSlide(officialStats),
    badgesSlide(data),
    personaSlide(data),
    prostSlide(data),
  ];
  return slides.filter((slide): slide is StorySlide => slide !== null);
}
