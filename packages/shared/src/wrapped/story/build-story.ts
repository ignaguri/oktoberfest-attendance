import type { WrappedData, WrappedOfficialStats } from "../../schemas/wrapped.schema";
import { getBestGlobalPosition } from "../utils";
import { derivePersona, festivalDayCount, personaName } from "./persona";
import type {
  BadgesSlide,
  BigNumberSlide,
  CompareSlide,
  CopyRef,
  DaysSlide,
  DrinksSlide,
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
/** Ties at the cutoff all get in, rather than luck picking one; this caps how long that can run. */
const MAX_TENTS_WITH_TIES = 5;
const KNOWN_DRINK_TYPES = ["beer", "radler", "alcohol_free", "wine", "soft_drink", "other"];

const copy = (key: string, params?: CopyRef["params"]): CopyRef =>
  params ? { key: `wrapped.story.${key}`, params } : { key: `wrapped.story.${key}` };

/**
 * Copy that says Wiesn. Other festivals get the key's Generic sibling; only
 * Oktoberfest is the Wiesn, even though Frühlingsfest shares its grounds.
 */
const WIESN_KEYS = new Set(
  [
    "bigNumber.tagline.zero",
    "bigNumber.comparison.median",
    "drinks.top.wine",
    "people.photosLabel",
    "persona.kicker",
    "persona.marathoner.description",
    "persona.massMeister.because",
  ].map((key) => `wrapped.story.${key}`),
);

export const forFestival = (ref: CopyRef, isWiesn: boolean): CopyRef =>
  isWiesn || !WIESN_KEYS.has(ref.key) ? ref : { ...ref, key: `${ref.key}Generic` };

const isWiesn = (data: WrappedData) => data.festivalInfo.festivalType === "oktoberfest";

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
        : forFestival(copy("bigNumber.comparison.median", { median: medianBeers }), isWiesn(data));
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
        : forFestival(copy(`bigNumber.tagline.${variant}`), isWiesn(data)),
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
    // Every type, zeros included, so the rows read as a full menu of what you did and didn't drink.
    // An empty "Other" says nothing, so it only shows when something landed there.
    breakdown: KNOWN_DRINK_TYPES.map((drinkType) => ({
      drinkType,
      count: breakdown
        .filter((drink) => drinkTypeKey(drink.drinkType) === drinkType)
        .reduce((sum, drink) => sum + drink.count, 0),
      label: copy(`drinkTypes.${drinkType}`),
    })).filter((drink) => drink.drinkType !== "other" || drink.count > 0),
    top: topDrinkType ? forFestival(copy(`drinks.top.${drinkTypeKey(topDrinkType)}`), isWiesn(data)) : null,
    spent: data.basicStats.totalSpent > 0 ? copy("drinks.spent", { amount: data.basicStats.totalSpent }) : null,
  };
}

function daysSlide(data: WrappedData): DaysSlide | null {
  if (!data.timeline.some((day) => day.beerCount > 0)) {
    return null;
  }
  const dayByDate = new Map(data.timeline.map((day) => [day.date, day]));
  const dayCount = festivalDayCount(data.festivalInfo.startDate, data.festivalInfo.endDate);
  const bars = Array.from({ length: dayCount }, (_, offset) => {
    const date = addDays(data.festivalInfo.startDate, offset);
    const day = dayByDate.get(date);
    return { date, beers: day?.beerCount ?? 0, attended: day !== undefined, tents: day?.tentsVisited ?? 0 };
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
    topTents: topTents(tentBreakdown, favoriteTent),
  };
}

function topTents(
  tentBreakdown: WrappedData["tentStats"]["tentBreakdown"],
  favoriteTent: string | null,
): TentsSlide["topTents"] {
  const sorted = [...tentBreakdown].sort(
    (a, b) =>
      b.visitCount - a.visitCount ||
      Number(b.tentName === favoriteTent) - Number(a.tentName === favoriteTent) ||
      a.tentName.localeCompare(b.tentName),
  );
  const cutoff = sorted[MAX_TENTS - 1]?.visitCount;
  return sorted
    .filter((tent, index) => index < MAX_TENTS || tent.visitCount === cutoff)
    .slice(0, MAX_TENTS_WITH_TIES)
    .map((tent) => ({ name: tent.tentName, visits: tent.visitCount, isFavorite: tent.tentName === favoriteTent }));
}

type Picture = WrappedData["socialStats"]["pictures"][number];

const byTakenAt = (a: Picture, b: Picture) => a.createdAt.localeCompare(b.createdAt);

/** `count` items evenly spaced from first to last (one alone is the middle). */
function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) {
    return items;
  }
  if (count === 1) {
    return [items[Math.floor((items.length - 1) / 2)]];
  }
  return Array.from({ length: count }, (_, index) => items[Math.round((index * (items.length - 1)) / (count - 1))]);
}

/**
 * The photos friends engaged with first (tags count double, see
 * get_wrapped_data), then the rest spread over the festival, so four uploads
 * from the last night don't crowd out the other days. Shown in the order taken.
 */
function pickPhotos(pictures: Picture[]): Picture[] {
  const social = pictures
    .filter((picture) => picture.socialScore > 0)
    .sort((a, b) => b.socialScore - a.socialScore || byTakenAt(b, a))
    .slice(0, MAX_PHOTOS);
  const rest = pictures.filter((picture) => !social.includes(picture)).sort(byTakenAt);
  return [...social, ...spread(rest, MAX_PHOTOS - social.length)].sort(byTakenAt);
}

function peopleSlide(data: WrappedData): PeopleSlide | null {
  const { groupsJoined, topRankings, pictures } = data.socialStats;
  const photos = pickPhotos(pictures).map((picture) => ({
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
    photosLabel: photos.length > 0 ? forFestival(copy("people.photosLabel"), isWiesn(data)) : null,
    photos,
  };
}

/** A comparison as a big stat ("+141%") over its caption; both read the same params. */
const compareRow = (key: string, params?: CopyRef["params"]) => ({
  stat: copy(`${key}.stat`, params),
  caption: copy(`${key}.caption`, params),
});

function compareSlide(data: WrappedData, tiny: boolean): CompareSlide | null {
  const { vsFestivalAvg, vsLastYear } = data.comparisons;
  const best = tiny ? null : getBestGlobalPosition(data);
  if (!vsLastYear && !best) {
    return null;
  }

  const rows: CompareSlide["rows"] = [];
  if (!tiny) {
    const diff = vsFestivalAvg.beersDiffPct;
    if (Math.abs(diff) < SAME_AS_AVERAGE_PCT) {
      rows.push(compareRow("compare.vsAvg.same"));
    } else if (diff > 0) {
      rows.push(compareRow("compare.vsAvg.more", { pct: diff }));
    } else {
      rows.push(compareRow("compare.vsAvg.less", { pct: -diff }));
    }
  }
  if (vsLastYear) {
    const festival = vsLastYear.prevFestivalName;
    if (vsLastYear.beersDiff > 0) {
      rows.push(compareRow("compare.vsLastYear.up", { diff: vsLastYear.beersDiff, festival }));
    } else if (vsLastYear.beersDiff < 0) {
      rows.push(compareRow("compare.vsLastYear.down", { diff: -vsLastYear.beersDiff, festival }));
    } else {
      rows.push(compareRow("compare.vsLastYear.same", { festival }));
    }
  }
  if (best) {
    rows.push(compareRow(`compare.global.${best.criteria}`, { position: best.position }));
  }

  return { kind: "compare", revealSteps: rows.length + 1, title: copy("compare.title"), rows };
}

/** How long after a festival its own city figures are still worth waiting for. */
const CHECK_BACK_DAYS = 30;

/** The city's figures next to yours: big cards for the crowd and your share, small ones for the fun facts. */
function wiesnAndYouSlide(
  data: WrappedData,
  stats: WrappedOfficialStats | null,
  now: Date,
): WiesnAndYouSlide | null {
  // Its copy is all Wiesn and Maß, so no other festival gets it yet
  if (!stats || !isWiesn(data)) {
    return null;
  }
  const when = stats.isCurrentFestival ? "current" : "lastYear";
  const beers = data.basicStats.totalBeers;
  const visitors =
    stats.visitors !== null
      ? {
          stat: copy("wiesnAndYou.visitorsStat", { visitors: stats.visitors }),
          caption: copy(`wiesnAndYou.visitors.${when}`),
        }
      : null;
  // "1 in 520,000" reads better than 0.00019%; the copy rounds it to two digits.
  const share =
    stats.massServed !== null && stats.massServed > 0 && beers > 0
      ? {
          stat: copy("wiesnAndYou.shareStat", { every: Math.round(stats.massServed / beers) }),
          caption: copy(`wiesnAndYou.share.${when}`, { count: beers }),
        }
      : null;
  const mugs =
    stats.mugsConfiscated !== null
      ? { stat: copy("wiesnAndYou.mugsStat", { mugs: stats.mugsConfiscated }), caption: copy("wiesnAndYou.mugs") }
      : null;
  const lostAndFound =
    stats.lostItems !== null
      ? {
          stat: copy("wiesnAndYou.lostStat", { count: stats.lostItems }),
          caption: copy("wiesnAndYou.lost", { count: stats.lostItems }),
        }
      : null;
  const finds = stats.curiousFinds;
  if (!visitors && !share && !mugs && !lostAndFound && finds.length === 0) {
    return null;
  }

  return {
    kind: "wiesnAndYou",
    // Kicker, each big card, the small cards together, then the finds.
    revealSteps:
      1 + Number(visitors !== null) + Number(share !== null) + Number(mugs !== null || lostAndFound !== null) + Number(finds.length > 0),
    kicker: copy(`wiesnAndYou.kicker.${when}`, { year: stats.year }),
    visitors,
    share,
    mugs,
    lostAndFound,
    findsLabel: copy("wiesnAndYou.findsLabel"),
    finds,
    source: sourceCopy(stats),
    // Last year's figures stand in until the city publishes this year's. Only
    // worth saying for a festival that just ended; an archived one never gets them.
    checkBack:
      !stats.isCurrentFestival &&
      now.getTime() - Date.parse(`${data.festivalInfo.endDate}T00:00:00Z`) <= CHECK_BACK_DAYS * 86_400_000
        ? copy("wiesnAndYou.checkBack")
        : null,
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
    count: {
      stat: copy("badges.countStat", { count: data.achievements.length }),
      caption: copy("badges.earned", { count: data.achievements.length }),
    },
    top,
    more: data.achievements.length > top.length ? copy("badges.more", { count: data.achievements.length - top.length }) : null,
  };
}

function personaSlide(data: WrappedData): PersonaSlide {
  const persona = derivePersona(data);
  const wiesn = isWiesn(data);
  return {
    kind: "persona",
    revealSteps: 5,
    kicker: forFestival(copy("persona.kicker"), wiesn),
    personaId: persona.id,
    name: personaName(persona.id, wiesn),
    description: forFestival(copy(`persona.${persona.id}.description`), wiesn),
    because: forFestival(persona.because, wiesn),
    runnerUp: persona.runnerUpId
      ? copy("persona.runnerUp", { name: personaName(persona.runnerUpId, wiesn) })
      : null,
  };
}

function prostSlide(data: WrappedData): ProstSlide {
  const persona = derivePersona(data);
  const { totalBeers, daysAttended } = data.basicStats;
  const tents = data.tentStats.uniqueTents;
  return {
    kind: "prost",
    revealSteps: 3,
    title: copy("prost.title"),
    summary: copy("prost.summary", { series: seriesName(data.festivalInfo.name) }),
    // The story in one card: the one thing people screenshot even if they never tap Share.
    recap: {
      personaId: persona.id,
      name: personaName(persona.id, isWiesn(data)),
      facts: [
        ...(totalBeers > 0 ? [copy("units.beers", { count: totalBeers })] : []),
        copy("prost.recap.days", { count: daysAttended }),
        ...(tents > 0 ? [copy("prost.recap.tents", { count: tents })] : []),
      ],
    },
  };
}

/** The ordered story for one Wrapped. Pure: views only translate and animate. */
export function buildWrappedStory(
  data: WrappedData,
  officialStats: WrappedOfficialStats | null,
  now: Date = new Date(),
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
    wiesnAndYouSlide(data, officialStats, now),
    badgesSlide(data),
    personaSlide(data),
    prostSlide(data),
  ];
  return slides.filter((slide): slide is StorySlide => slide !== null);
}
