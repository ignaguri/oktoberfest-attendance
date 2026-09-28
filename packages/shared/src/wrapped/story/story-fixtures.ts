import type { WrappedData, WrappedOfficialStats } from "../../schemas/wrapped.schema";

/**
 * A complete, realistic Wrapped (the API's wrapped-data.full.json in camelCase,
 * plus timing). Tests mutate a clone; nothing here is exported from the package
 * root, only from @prostcounter/shared/wrapped/testing.
 */
const BASE: WrappedData = {
  userInfo: { username: "maxi", fullName: "Maxi Muster", avatarUrl: "avatars/maxi.jpg" },
  festivalInfo: {
    name: "Oktoberfest 2026",
    startDate: "2026-09-19",
    endDate: "2026-10-04",
    location: "Munich",
  },
  basicStats: { totalBeers: 12.5, daysAttended: 4, avgBeers: 3.13, totalSpent: 198.4, beerCost: 15.8 },
  tentStats: {
    uniqueTents: 3,
    favoriteTent: "Augustiner-Festhalle",
    tentDiversityPct: 17.6,
    tentBreakdown: [
      { tentName: "Augustiner-Festhalle", visitCount: 3 },
      { tentName: "Schottenhamel", visitCount: 1 },
    ],
  },
  peakMoments: {
    bestDay: { date: "2026-09-20", beerCount: 5, tentsVisited: 2, spent: 79 },
    maxSingleSession: 5,
    mostExpensiveDay: { date: "2026-09-20", amount: 79 },
  },
  socialStats: {
    groupsJoined: 2,
    topRankings: [{ groupName: "Die Durstigen", position: 1 }],
    photosUploaded: 1,
    totalGroupMembers: 9,
    pictures: [
      {
        id: "7f7a6a3e-8f7d-4c35-9d6a-1b2c3d4e5f60",
        pictureUrl: "pics/a.jpg",
        createdAt: "2026-09-20T14:03:11.123456+00:00",
        attendanceDate: "2026-09-20",
      },
    ],
  },
  globalLeaderboardPositions: { daysAttended: 7, totalBeers: 11, avgBeers: null },
  achievements: [
    {
      id: "2b1d7c4e-3a5f-4e6b-8c9d-0e1f2a3b4c5d",
      name: "First Maß",
      description: "Log your first beer",
      icon: "masskrug",
      category: "consumption",
      tier: 1,
      points: 10,
      rarity: "common",
      unlockedAt: "2026-09-19T11:00:00+00:00",
    },
  ],
  timeline: [
    { date: "2026-09-19", beerCount: 2, spent: 31.6, tentsVisited: 1 },
    { date: "2026-09-20", beerCount: 5, spent: 79, tentsVisited: 2 },
  ],
  comparisons: {
    vsFestivalAvg: {
      beersDiffPct: 40.2,
      daysDiffPct: 12.5,
      avgBeers: 8.9,
      avgDays: 3.5,
      medianBeers: 7,
      medianDays: 3,
      beersPercentile: 81.3,
      daysPercentile: 66.7,
      attendeeCount: 64,
    },
    vsLastYear: {
      beersDiff: 2.5,
      daysDiff: 1,
      spentDiff: 40.1,
      prevBeers: 10,
      prevDays: 3,
      prevFestivalName: "Oktoberfest 2025",
    },
  },
  personality: { type: "Loyalist", traits: ["Early Bird"] },
  drinkStats: {
    totalDrinks: 14,
    topDrinkType: "beer",
    breakdown: [
      { drinkType: "beer", count: 11, percentage: 78.6 },
      { drinkType: "radler", count: 3, percentage: 21.4 },
    ],
  },
  timing: {
    timedDays: 2,
    medianFirstHour: 14,
    medianLastHour: 20,
    peakHour: 17,
    weekendShare: 0.5,
  },
};

export function makeWrapped(mutate?: (data: WrappedData) => void): WrappedData {
  const data = structuredClone(BASE);
  mutate?.(data);
  return data;
}

export function makeOfficialStats(overrides: Partial<WrappedOfficialStats> = {}): WrappedOfficialStats {
  return {
    year: 2026,
    isCurrentFestival: true,
    visitors: 6500000,
    massServed: 6500000,
    mugsConfiscated: 116000,
    lostItems: 4500,
    curiousFinds: [
      { de: "ein Akkordeon", en: "an accordion", es: "un acordeón" },
      { de: "eine Knirschschiene", en: "a night guard", es: "una placa de descanso" },
    ],
    sourceUrl: "https://www.muenchen.de/veranstaltungen/oktoberfest/aktuell/wiesn-bilanz",
    ...overrides,
  };
}
