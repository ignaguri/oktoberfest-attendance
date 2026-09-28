import { describe, expect, it } from "vitest";

import { buildWrappedStory } from "./build-story";
import { makeOfficialStats, makeWrapped } from "./story-fixtures";
import type { StorySlide, StorySlideKind, StorySlideOf } from "./types";

const kinds = (slides: StorySlide[]) => slides.map((slide) => slide.kind);

function find<K extends StorySlideKind>(slides: StorySlide[], kind: K): StorySlideOf<K> {
  const slide = slides.find((candidate) => candidate.kind === kind);
  if (!slide) {
    throw new Error(`no ${kind} slide`);
  }
  return slide as StorySlideOf<K>;
}

const zeroDrinks = () =>
  makeWrapped((data) => {
    data.basicStats = { totalBeers: 0, daysAttended: 1, avgBeers: 0, totalSpent: 0, beerCost: 15.8 };
    data.drinkStats = { totalDrinks: 0, topDrinkType: null, breakdown: [] };
    data.timeline = [{ date: "2026-09-19", beerCount: 0, spent: 0, tentsVisited: 0 }];
    data.tentStats = { uniqueTents: 0, favoriteTent: null, tentDiversityPct: 0, tentBreakdown: [] };
    data.peakMoments = { bestDay: null, maxSingleSession: 0, mostExpensiveDay: null };
    data.socialStats = { groupsJoined: 0, topRankings: [], photosUploaded: 0, totalGroupMembers: 0, pictures: [] };
    data.globalLeaderboardPositions = { daysAttended: null, totalBeers: null, avgBeers: null };
    data.achievements = [];
    data.comparisons.vsLastYear = null;
    data.timing = { timedDays: 0, medianFirstHour: null, medianLastHour: null, peakHour: null, weekendShare: 0 };
  });

describe("buildWrappedStory", () => {
  it("builds all 12 slides in order for a full Wrapped with current stats", () => {
    expect(kinds(buildWrappedStory(makeWrapped(), makeOfficialStats()))).toEqual([
      "servus",
      "bigNumber",
      "drinks",
      "days",
      "tents",
      "people",
      "compare",
      "wiesnAndYou",
      "meanwhile",
      "badges",
      "persona",
      "prost",
    ]);
  });

  it("keeps a zero-drink attendee's story short and kind", () => {
    const slides = buildWrappedStory(zeroDrinks(), makeOfficialStats());
    expect(kinds(slides)).toEqual(["servus", "bigNumber", "wiesnAndYou", "meanwhile", "persona", "prost"]);
    expect(find(slides, "bigNumber").variant).toBe("zero");
    expect(find(slides, "bigNumber").comparison).toBeNull();
    expect(find(slides, "wiesnAndYou").share).toBeNull();
    expect(find(slides, "persona").personaId).toBe("geniesser");
  });

  it("uses the low variant under 3 beers", () => {
    const slides = buildWrappedStory(makeWrapped((data) => { data.basicStats.totalBeers = 2; }), null);
    expect(find(slides, "bigNumber").variant).toBe("low");
    expect(find(slides, "bigNumber").tagline.key).toBe("wrapped.story.bigNumber.tagline.low");
  });

  it("shows the percentile only when it flatters", () => {
    const high = buildWrappedStory(makeWrapped(), null);
    expect(find(high, "bigNumber").comparison).toEqual({
      key: "wrapped.story.bigNumber.comparison.percentile",
      params: { pct: 81.3 },
    });
    const low = buildWrappedStory(
      makeWrapped((data) => { data.comparisons.vsFestivalAvg.beersPercentile = 40; }),
      null,
    );
    expect(find(low, "bigNumber").comparison).toEqual({
      key: "wrapped.story.bigNumber.comparison.median",
      params: { median: 7 },
    });
  });

  it("drops festival-wide comparisons at a tiny festival", () => {
    const slides = buildWrappedStory(
      makeWrapped((data) => { data.comparisons.vsFestivalAvg.attendeeCount = 3; }),
      null,
    );
    expect(find(slides, "bigNumber").comparison).toBeNull();
    expect(find(slides, "compare").rows.map((row) => row.key)).toEqual([
      "wrapped.story.compare.vsLastYear.up",
    ]);
  });

  it("drops the compare slide without last year and at a tiny festival", () => {
    const slides = buildWrappedStory(
      makeWrapped((data) => {
        data.comparisons.vsLastYear = null;
        data.comparisons.vsFestivalAvg.attendeeCount = 3;
      }),
      null,
    );
    expect(kinds(slides)).not.toContain("compare");
  });

  it("drops the people slide with no groups and no photos", () => {
    const slides = buildWrappedStory(
      makeWrapped((data) => {
        data.socialStats.groupsJoined = 0;
        data.socialStats.topRankings = [];
        data.socialStats.pictures = [];
      }),
      null,
    );
    expect(kinds(slides)).not.toContain("people");
  });

  it("drops the best-day callout when the best day had no beers", () => {
    const slides = buildWrappedStory(
      makeWrapped((data) => {
        data.peakMoments.bestDay = { date: "2026-09-20", beerCount: 0, tentsVisited: 1, spent: 0 };
      }),
      null,
    );
    expect(find(slides, "days").bestDay).toBeNull();
  });

  it("lays out one bar per festival day", () => {
    const days = find(buildWrappedStory(makeWrapped(), null), "days");
    expect(days.bars).toHaveLength(16);
    expect(days.bars[1]).toEqual({ date: "2026-09-20", beers: 5, attended: true });
    expect(days.bars[2]).toEqual({ date: "2026-09-21", beers: 0, attended: false });
    expect(days.maxBeers).toBe(5);
  });

  it("maps an unknown drink type to other", () => {
    const drinks = find(
      buildWrappedStory(
        makeWrapped((data) => {
          data.drinkStats.topDrinkType = "mead";
          data.drinkStats.breakdown = [{ drinkType: "mead", count: 14, percentage: 100 }];
        }),
        null,
      ),
      "drinks",
    );
    expect(drinks.top?.key).toBe("wrapped.story.drinks.top.other");
    expect(drinks.breakdown[0].label.key).toBe("wrapped.story.drinkTypes.other");
  });

  it("words last year's stats as last year and names the source", () => {
    const slides = buildWrappedStory(makeWrapped(), makeOfficialStats({ year: 2025, isCurrentFestival: false }));
    const wiesn = find(slides, "wiesnAndYou");
    expect(wiesn.kicker).toEqual({ key: "wrapped.story.wiesnAndYou.kicker.lastYear", params: { year: 2025 } });
    expect(wiesn.headline.key).toBe("wrapped.story.wiesnAndYou.headline.lastYear");
    expect(wiesn.source).toEqual({
      key: "wrapped.story.source.withHost",
      params: { host: "muenchen.de", year: 2025 },
    });
    expect(find(slides, "meanwhile").mugsLine?.key).toBe("wrapped.story.meanwhile.mugs.lastYear");
  });

  it("computes the share of the Wiesn", () => {
    const wiesn = find(buildWrappedStory(makeWrapped(), makeOfficialStats()), "wiesnAndYou");
    expect(wiesn.share?.params?.pct).toBeCloseTo((12.5 / 6500000) * 100, 10);
  });

  it("skips the city slides without stats, and each one without its own fields", () => {
    expect(kinds(buildWrappedStory(makeWrapped(), null))).not.toContain("wiesnAndYou");
    const partial = kinds(
      buildWrappedStory(makeWrapped(), makeOfficialStats({ visitors: null, mugsConfiscated: null, curiousFinds: [] })),
    );
    expect(partial).not.toContain("wiesnAndYou");
    expect(partial).not.toContain("meanwhile");
  });

  it("orders badges by tier and keeps three", () => {
    const badges = find(
      buildWrappedStory(
        makeWrapped((data) => {
          const base = data.achievements[0];
          data.achievements = [1, 3, 2, 4].map((tier, index) => ({
            ...base,
            id: `a${index}`,
            tier,
            points: tier * 10,
          }));
        }),
        null,
      ),
      "badges",
    );
    expect(badges.top.map((badge) => badge.tier)).toEqual([4, 3, 2]);
    expect(badges.count.params).toEqual({ count: 4 });
  });

  it("names the series without the year on the last slide", () => {
    const prost = find(buildWrappedStory(makeWrapped(), null), "prost");
    expect(prost.summary).toEqual({ key: "wrapped.story.prost.summary", params: { series: "Oktoberfest" } });
  });
});
